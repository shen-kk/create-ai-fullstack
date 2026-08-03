import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type {
  SendVerificationCodeResponse,
  VerificationChannel,
  VerificationPurpose,
  VerificationDeliveryListResponse,
  VerificationDeliveryQuery,
} from '@template/contracts';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';
import { PrismaService } from '../database/prisma.service.js';
import { IntegrationsService } from '../integrations/integrations.service.js';

interface MemoryCode {
  id: string;
  channel: VerificationChannel;
  targetHash: string;
  purpose: VerificationPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  targetMasked: string;
  deliveryStatus: string;
  failureCode: string | null;
}
const memory: MemoryCode[] = [];
const ttlSeconds = 300;
const retrySeconds = 60;
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  async send(
    channel: VerificationChannel,
    rawTarget: string,
    purpose: VerificationPurpose,
  ): Promise<SendVerificationCodeResponse> {
    const target = this.normalize(channel, rawTarget);
    const targetHash = hash(target);
    const latest = await this.latest(targetHash, purpose);
    if (latest && Date.now() - latest.createdAt.getTime() < retrySeconds * 1000)
      throw new HttpException('VERIFICATION_RETRY_LATER', HttpStatus.TOO_MANY_REQUESTS);
    const integration = await this.integrations.runtimeConfig(channel);
    const development =
      process.env.NODE_ENV !== 'production' && process.env.DATA_SOURCE !== 'prisma';
    if (!development && (!integration.enabled || !Object.keys(integration.values).length))
      throw new BadRequestException(`${channel.toUpperCase()}_NOT_CONFIGURED`);
    const code = String(randomInt(100000, 1000000));
    const recordId = randomUUID();
    await this.store({
      id: recordId,
      channel,
      targetHash,
      purpose,
      codeHash: hash(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      consumedAt: null,
      createdAt: new Date(),
      targetMasked: this.mask(channel, target),
      deliveryStatus: development ? 'sent' : 'pending',
      failureCode: null,
    });
    // Development preview deliberately returns the code; production delivery adapters consume the encrypted runtime config.
    if (!development) {
      try {
        await this.deliver(channel, target, code, {
          ...integration.values,
          ...integration.secrets,
        });
        await this.markDelivery(recordId, 'sent', null);
      } catch (error) {
        const failure = error instanceof Error ? error.message : 'DELIVERY_FAILED';
        await this.markDelivery(recordId, 'failed', failure);
        throw error;
      }
    }
    return {
      expiresIn: ttlSeconds,
      retryAfter: retrySeconds,
      ...(development ? { developmentCode: code } : {}),
    };
  }
  async list(query: VerificationDeliveryQuery): Promise<VerificationDeliveryListResponse> {
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 20,
      now = new Date();
    if (process.env.DATA_SOURCE === 'prisma') {
      const where = {
        ...(query.channel ? { channel: query.channel } : {}),
        ...(query.purpose ? { purpose: query.purpose } : {}),
        ...(query.status === 'failed'
          ? { deliveryStatus: 'failed' }
          : query.status === 'consumed'
            ? { consumedAt: { not: null } }
            : query.status === 'expired'
              ? { consumedAt: null, expiresAt: { lte: now } }
              : query.status === 'sent'
                ? { deliveryStatus: 'sent', consumedAt: null, expiresAt: { gt: now } }
                : {}),
      };
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.verificationCode.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.verificationCode.count({ where }),
      ]);
      return { items: rows.map((row) => this.summary(row as MemoryCode)), page, pageSize, total };
    }
    const rows = [...memory]
      .filter((row) => !query.channel || row.channel === query.channel)
      .filter((row) => !query.purpose || row.purpose === query.purpose)
      .filter((row) => !query.status || this.status(row) === query.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map((row) => this.summary(row)),
      page,
      pageSize,
      total: rows.length,
    };
  }

  async consume(
    channel: VerificationChannel,
    rawTarget: string,
    purpose: VerificationPurpose,
    code: string,
  ): Promise<void> {
    const record = await this.latest(hash(this.normalize(channel, rawTarget)), purpose);
    if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now())
      throw new BadRequestException('VERIFICATION_CODE_INVALID');
    if (record.attempts >= 5)
      throw new HttpException('VERIFICATION_ATTEMPTS_EXCEEDED', HttpStatus.TOO_MANY_REQUESTS);
    const valid = timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(hash(code)));
    await this.mark(record.id, valid);
    if (!valid) throw new BadRequestException('VERIFICATION_CODE_INVALID');
  }

  private normalize(channel: VerificationChannel, target: string): string {
    const value = target.trim().toLowerCase();
    if (channel === 'sms' && !/^1\d{10}$/.test(value))
      throw new BadRequestException('INVALID_PHONE');
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
      throw new BadRequestException('INVALID_EMAIL');
    return value;
  }
  private mask(channel: VerificationChannel, target: string): string {
    if (channel === 'sms') return `${target.slice(0, 3)}****${target.slice(-4)}`;
    const [name, domain] = target.split('@');
    return `${name?.slice(0, 2) ?? ''}***@${domain ?? ''}`;
  }
  private status(record: MemoryCode): 'sent' | 'failed' | 'consumed' | 'expired' {
    if (record.deliveryStatus === 'failed') return 'failed';
    if (record.consumedAt) return 'consumed';
    if (record.expiresAt <= new Date()) return 'expired';
    return 'sent';
  }
  private summary(record: MemoryCode) {
    return {
      id: record.id,
      channel: record.channel,
      purpose: record.purpose,
      targetMasked: record.targetMasked,
      status: this.status(record),
      attempts: record.attempts,
      failureCode: record.failureCode,
      createdAt: record.createdAt.toISOString(),
      consumedAt: record.consumedAt?.toISOString() ?? null,
    };
  }
  private async latest(
    targetHash: string,
    purpose: VerificationPurpose,
  ): Promise<MemoryCode | null> {
    if (process.env.DATA_SOURCE === 'prisma')
      return this.prisma.verificationCode.findFirst({
        where: { targetHash, purpose },
        orderBy: { createdAt: 'desc' },
      }) as Promise<MemoryCode | null>;
    return (
      [...memory]
        .reverse()
        .find((item) => item.targetHash === targetHash && item.purpose === purpose) ?? null
    );
  }
  private async store(record: MemoryCode): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.verificationCode.create({ data: record });
      return;
    }
    memory.push(record);
  }
  private async mark(id: string, valid: boolean): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.verificationCode.update({
        where: { id },
        data: valid ? { consumedAt: new Date() } : { attempts: { increment: 1 } },
      });
      return;
    }
    const record = memory.find((item) => item.id === id);
    if (record) valid ? (record.consumedAt = new Date()) : (record.attempts += 1);
  }
  private async markDelivery(
    id: string,
    deliveryStatus: string,
    failureCode: string | null,
  ): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.verificationCode.update({
        where: { id },
        data: { deliveryStatus, failureCode },
      });
      return;
    }
    const record = memory.find((item) => item.id === id);
    if (record) {
      record.deliveryStatus = deliveryStatus;
      record.failureCode = failureCode;
    }
  }
  private async deliver(
    channel: VerificationChannel,
    target: string,
    code: string,
    values: Record<string, string>,
  ): Promise<void> {
    if (channel === 'sms' && values.provider === 'tencent_sms') {
      await this.sendTencentSms(target, code, values);
      return;
    }
    if (channel === 'email' && values.provider === 'smtp') {
      await this.sendSmtp(target, code, values);
      return;
    }
    throw new BadRequestException(`${channel.toUpperCase()}_PROVIDER_ADAPTER_REQUIRED`);
  }
  private async sendTencentSms(
    phone: string,
    code: string,
    config: Record<string, string>,
  ): Promise<void> {
    const secretId = config.accessKeyId,
      secretKey = config.accessKeySecret;
    if (!secretId || !secretKey || !config.appId || !config.templateId || !config.signName)
      throw new BadRequestException('SMS_CONFIG_INCOMPLETE');
    const host = 'sms.tencentcloudapi.com',
      service = 'sms',
      timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: config.appId,
      SignName: config.signName,
      TemplateId: config.templateId,
      TemplateParamSet: [code, '5'],
    });
    const hashedPayload = hash(payload),
      canonical = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`;
    const scope = `${date}/${service}/tc3_request`,
      stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`;
    const hmac = (key: string | Buffer, value: string): Buffer =>
      createHmac('sha256', key).update(value).digest();
    const signature = createHmac(
      'sha256',
      hmac(hmac(hmac(`TC3${secretKey}`, date), service), 'tc3_request'),
    )
      .update(stringToSign)
      .digest('hex');
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`;
    const response = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: host,
        'X-TC-Action': 'SendSms',
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': '2021-01-11',
        'X-TC-Region': config.region || 'ap-guangzhou',
      },
      body: payload,
    });
    const result = (await response.json()) as { Response?: { Error?: { Code: string } } };
    if (!response.ok || result.Response?.Error)
      throw new BadRequestException('SMS_DELIVERY_FAILED');
  }
  private async sendSmtp(
    target: string,
    code: string,
    config: Record<string, string>,
  ): Promise<void> {
    if (!config.host || !config.port || !config.username || !config.password || !config.from)
      throw new BadRequestException('EMAIL_CONFIG_INCOMPLETE');
    if (config.secure === 'false') throw new BadRequestException('SMTP_TLS_REQUIRED');
    const socket = tlsConnect({
      host: config.host,
      port: Number(config.port),
      servername: config.host,
      rejectUnauthorized: true,
    });
    const read = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SMTP_TIMEOUT')), 10000);
        socket.once('data', (data) => {
          clearTimeout(timer);
          resolve(data.toString());
        });
        socket.once('error', reject);
      });
    const command = async (value: string, accepted = /^[23]/): Promise<string> => {
      socket.write(`${value}\r\n`);
      const response = await read();
      if (!accepted.test(response)) throw new Error('SMTP_REJECTED');
      return response;
    };
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('error', reject);
      });
      await read();
      await command(`EHLO ${config.host}`);
      await command('AUTH LOGIN', /^334/);
      await command(Buffer.from(config.username).toString('base64'), /^334/);
      await command(Buffer.from(config.password).toString('base64'), /^235/);
      await command(`MAIL FROM:<${config.from}>`);
      await command(`RCPT TO:<${target}>`);
      await command('DATA', /^354/);
      const subject = Buffer.from('账号验证码').toString('base64');
      await command(
        `From: ${config.from}\r\nTo: ${target}\r\nSubject: =?UTF-8?B?${subject}?=\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n您的验证码是 ${code}，5 分钟内有效。请勿转发。\r\n.`,
      );
      await command('QUIT');
    } catch {
      throw new BadRequestException('EMAIL_DELIVERY_FAILED');
    } finally {
      socket.destroy();
    }
  }
}
