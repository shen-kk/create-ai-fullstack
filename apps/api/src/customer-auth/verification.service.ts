import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type {
  SendVerificationCodeResponse,
  VerificationChannel,
  VerificationPurpose,
  VerificationDeliveryListResponse,
  VerificationDeliveryQuery,
  ServiceFeatureCode,
  MessageTemplateSummary,
} from '@template/contracts';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';
import { PrismaService } from '../database/prisma.service.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { project } from '../generated/project.js';

interface VerificationRecord {
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
    if (purpose !== 'bind_contact') await this.integrations.assertCustomerAuthChannel(channel);
    const settings = await this.integrations.getCustomerAuthSettings();
    const ttlSeconds = settings.verificationTtlSeconds;
    const retrySeconds = settings.verificationRetrySeconds;
    const targetHash = hash(target);
    const latest = await this.latest(targetHash, purpose, ['pending', 'sent']);
    if (latest && Date.now() - latest.createdAt.getTime() < retrySeconds * 1000)
      throw new HttpException('VERIFICATION_RETRY_LATER', HttpStatus.TOO_MANY_REQUESTS);
    const featurePurpose = purpose === 'reset_password' ? 'password_reset' : purpose;
    const featureCode = `customer.${channel}_${featurePurpose}` as ServiceFeatureCode;
    const integration = await this.integrations.runtimeConfig(channel, featureCode);
    if (!integration.enabled || !Object.keys(integration.values).length)
      throw new BadRequestException(`${channel.toUpperCase()}_NOT_CONFIGURED`);
    if (!integration.template) throw new BadRequestException('MESSAGE_TEMPLATE_NOT_CONFIGURED');
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
      deliveryStatus: 'pending',
      failureCode: null,
    });
    try {
      await this.deliver(
        channel,
        target,
        code,
        {
          ...integration.values,
          ...integration.secrets,
        },
        integration.template,
        purpose,
        ttlSeconds,
      );
      await this.markDelivery(recordId, 'sent', null);
    } catch (error) {
      const failure = error instanceof Error ? error.message : 'DELIVERY_FAILED';
      await this.markDelivery(recordId, 'failed', failure);
      throw error;
    }
    return { expiresIn: ttlSeconds, retryAfter: retrySeconds };
  }
  async list(query: VerificationDeliveryQuery): Promise<VerificationDeliveryListResponse> {
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 20,
      now = new Date();
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
    return {
      items: rows.map((row) => this.summary(row as VerificationRecord)),
      page,
      pageSize,
      total,
    };
  }

  async consume(
    channel: VerificationChannel,
    rawTarget: string,
    purpose: VerificationPurpose,
    code: string,
  ): Promise<void> {
    const record = await this.latest(hash(this.normalize(channel, rawTarget)), purpose, ['sent']);
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
  private status(record: VerificationRecord): 'sent' | 'failed' | 'consumed' | 'expired' {
    if (record.deliveryStatus === 'failed') return 'failed';
    if (record.consumedAt) return 'consumed';
    if (record.expiresAt <= new Date()) return 'expired';
    return 'sent';
  }
  private summary(record: VerificationRecord) {
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
    deliveryStatuses?: string[],
  ): Promise<VerificationRecord | null> {
    return this.prisma.verificationCode.findFirst({
      where: {
        targetHash,
        purpose,
        ...(deliveryStatuses?.length ? { deliveryStatus: { in: deliveryStatuses } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<VerificationRecord | null>;
  }
  private async store(record: VerificationRecord): Promise<void> {
    await this.prisma.verificationCode.create({ data: record });
  }
  private async mark(id: string, valid: boolean): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: valid ? { consumedAt: new Date() } : { attempts: { increment: 1 } },
    });
  }
  private async markDelivery(
    id: string,
    deliveryStatus: string,
    failureCode: string | null,
  ): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: { deliveryStatus, failureCode },
    });
  }
  private async deliver(
    channel: VerificationChannel,
    target: string,
    code: string,
    values: Record<string, string>,
    template: MessageTemplateSummary | undefined,
    purpose: VerificationPurpose,
    ttlSeconds: number,
  ): Promise<void> {
    if (channel === 'sms' && values.provider === 'tencent_sms') {
      await this.sendTencentSms(target, code, values, template, purpose, ttlSeconds);
      return;
    }
    if (channel === 'email' && values.provider === 'smtp') {
      await this.sendSmtp(target, code, values, template, purpose, ttlSeconds);
      return;
    }
    if (channel === 'email' && values.provider === 'tencent_ses') {
      await this.sendTencentSes(target, code, values, template, purpose, ttlSeconds);
      return;
    }
    throw new BadRequestException(`${channel.toUpperCase()}_PROVIDER_ADAPTER_REQUIRED`);
  }
  private async sendTencentSms(
    phone: string,
    code: string,
    config: Record<string, string>,
    template?: MessageTemplateSummary,
    purpose: VerificationPurpose = 'login',
    ttlSeconds = 300,
  ): Promise<void> {
    const secretId = config.accessKeyId,
      secretKey = config.accessKeySecret;
    const templateId = template?.providerTemplateId || config.templateId;
    if (!secretId || !secretKey || !config.appId || !templateId || !config.signName)
      throw new BadRequestException('SMS_CONFIG_INCOMPLETE');
    const host = 'sms.tencentcloudapi.com',
      service = 'sms',
      timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: config.appId,
      SignName: config.signName,
      TemplateId: templateId,
      TemplateParamSet: this.providerParameters(template, code, purpose, ttlSeconds),
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
    template?: MessageTemplateSummary,
    purpose: VerificationPurpose = 'login',
    ttlSeconds = 300,
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
        socket.once('data', (data: Buffer) => {
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
      const subject = Buffer.from(
        this.render(template?.subject || '{{projectName}} 账号验证码', code, purpose, ttlSeconds),
      ).toString('base64');
      const content = this.render(
        template?.htmlBody ||
          template?.textBody ||
          '您的验证码是 {{code}}，{{minutes}} 分钟内有效。请勿转发。',
        code,
        purpose,
        ttlSeconds,
      );
      const contentType = template?.htmlBody ? 'text/html' : 'text/plain';
      const deliveryContent = template?.htmlBody ? this.wrapEmailHtml(content) : content;
      await command(
        `From: ${config.from}\r\nTo: ${target}\r\nSubject: =?UTF-8?B?${subject}?=\r\nContent-Type: ${contentType}; charset=utf-8\r\n\r\n${deliveryContent}\r\n.`,
      );
      await command('QUIT');
    } catch {
      throw new BadRequestException('EMAIL_DELIVERY_FAILED');
    } finally {
      socket.destroy();
    }
  }

  private async sendTencentSes(
    target: string,
    code: string,
    config: Record<string, string>,
    template?: MessageTemplateSummary,
    purpose: VerificationPurpose = 'login',
    ttlSeconds = 300,
  ): Promise<void> {
    const secretId = config.accessKeyId,
      secretKey = config.accessKeySecret,
      templateId = Number(template?.providerTemplateId || config.templateId);
    if (!secretId || !secretKey || !config.from || !Number.isInteger(templateId) || templateId <= 0)
      throw new BadRequestException('EMAIL_CONFIG_INCOMPLETE');
    const host = 'ses.tencentcloudapi.com',
      service = 'ses',
      timestamp = Math.floor(Date.now() / 1000),
      date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      FromEmailAddress: config.from,
      Destination: [target],
      Subject: this.render(
        template?.subject || '{{projectName}} 账号验证码',
        code,
        purpose,
        ttlSeconds,
      ),
      Template: {
        TemplateID: templateId,
        TemplateData: JSON.stringify(
          this.providerParameterObject(template, code, purpose, ttlSeconds),
        ),
      },
    });
    const hashedPayload = hash(payload),
      canonical = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`,
      scope = `${date}/${service}/tc3_request`,
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
    try {
      const response = await fetch(`https://${host}`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json; charset=utf-8',
          Host: host,
          'X-TC-Action': 'SendEmail',
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Version': '2020-10-02',
          'X-TC-Region': config.region || 'ap-guangzhou',
        },
        body: payload,
      });
      const result = (await response.json()) as { Response?: { Error?: { Code: string } } };
      if (!response.ok || result.Response?.Error)
        throw new BadRequestException('EMAIL_DELIVERY_FAILED');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('EMAIL_DELIVERY_FAILED');
    }
  }
  private render(
    source: string,
    code: string,
    purpose: VerificationPurpose,
    ttlSeconds = 300,
  ): string {
    const purposeLabels: Record<VerificationPurpose, string> = {
      register: '注册验证',
      login: '登录验证',
      reset_password: '找回密码',
      bind_contact: '绑定联系方式',
    };
    const values: Record<string, string> = {
      code,
      minutes: String(Math.ceil(ttlSeconds / 60)),
      projectName: project.displayName,
      purpose: purposeLabels[purpose],
    };
    return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? '');
  }
  private wrapEmailHtml(content: string): string {
    return `<!doctype html><html lang="zh-CN"><body style="margin:0;padding:0;background:#f3f5f9;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f9;padding:36px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e9f2;border-radius:16px;box-shadow:0 12px 36px rgba(31,41,55,.08);"><tr><td style="padding:32px 36px;line-height:1.75;font-size:15px;">${content}<div style="height:1px;background:#edf0f5;margin:28px 0 18px;"></div><p style="margin:0;color:#8a94a6;font-size:12px;">此邮件由 ${project.displayName} 自动发送，请勿直接回复。</p></td></tr></table></td></tr></table></body></html>`;
  }
  private providerParameterObject(
    template: MessageTemplateSummary | undefined,
    code: string,
    purpose: VerificationPurpose,
    ttlSeconds = 300,
  ): Record<string, string> {
    const mapping = template?.parameterMapping ?? { code: '{{code}}', minutes: '{{minutes}}' };
    return Object.fromEntries(
      Object.entries(mapping).map(([key, value]) => [
        key,
        this.render(value, code, purpose, ttlSeconds),
      ]),
    );
  }
  private providerParameters(
    template: MessageTemplateSummary | undefined,
    code: string,
    purpose: VerificationPurpose,
    ttlSeconds = 300,
  ): string[] {
    const values = this.providerParameterObject(template, code, purpose, ttlSeconds);
    return Object.keys(values)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => values[key] ?? '');
  }
}
