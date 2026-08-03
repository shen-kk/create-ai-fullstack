import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  IntegrationConfigSummary,
  IntegrationField,
  IntegrationKind,
  UpdateIntegrationConfigRequest,
} from '@template/contracts';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { project } from '../generated/project.js';
import { AuditService } from '../audit/audit.service.js';

const field = (
  key: string,
  label: string,
  secret = false,
  required = true,
  options?: Array<{ value: string; label: string }>,
): IntegrationField => ({ key, label, secret, required, ...(options ? { options } : {}) });
const definitions: Record<
  IntegrationKind,
  { name: string; description: string; fields: IntegrationField[] }
> = {
  object_storage: {
    name: '对象存储',
    description: 'S3、OSS、COS 等文件和头像存储',
    fields: [
      field('provider', '存储平台', false, true, [
        { value: 'tencent_cos', label: '腾讯云 COS' },
        { value: 'aliyun_oss', label: '阿里云 OSS' },
        { value: 'aws_s3', label: 'AWS S3' },
        { value: 's3_compatible', label: 'S3 兼容存储' },
      ]),
      field('endpoint', '服务地址', false, false),
      field('bucket', 'Bucket'),
      field('region', '区域'),
      field('accessKeyId', 'Access Key ID'),
      field('secretAccessKey', 'Access Key Secret', true),
    ],
  },
  sql: {
    name: 'SQL 数据库',
    description: '业务 PostgreSQL/MySQL 连接信息',
    fields: [
      field('engine', '数据库类型', false, true, [
        { value: 'postgresql', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'mariadb', label: 'MariaDB' },
        { value: 'sqlserver', label: 'SQL Server' },
      ]),
      field('host', '主机'),
      field('port', '端口'),
      field('database', '数据库'),
      field('username', '用户名'),
      field('password', '密码', true),
    ],
  },
  redis: {
    name: 'Redis',
    description: '缓存、限流、队列和会话',
    fields: [
      field('provider', '部署平台', false, true, [
        { value: 'self_hosted', label: '自建 Redis' },
        { value: 'tencent_redis', label: '腾讯云 Redis' },
        { value: 'aliyun_redis', label: '阿里云 Redis' },
      ]),
      field('url', '连接地址'),
      field('password', '密码', true, false),
    ],
  },
  sms: {
    name: '短信服务',
    description: '验证码与通知短信',
    fields: [
      field('provider', '服务商', false, true, [
        { value: 'tencent_sms', label: '腾讯云短信' },
        { value: 'aliyun_sms', label: '阿里云短信' },
      ]),
      field('region', '区域'),
      field('accessKeyId', 'Access Key ID'),
      field('accessKeySecret', 'Access Key Secret', true),
      field('signName', '短信签名'),
      field('appId', '短信应用 SDK AppID'),
      field('templateId', '验证码模板 ID'),
    ],
  },
  email: {
    name: '邮件服务',
    description: 'SMTP 通知和验证邮件',
    fields: [
      field('provider', '邮件平台', false, true, [
        { value: 'smtp', label: '通用 SMTP' },
        { value: 'tencent_ses', label: '腾讯云 SES' },
        { value: 'aliyun_dm', label: '阿里云邮件推送' },
      ]),
      field('host', 'SMTP 主机'),
      field('port', '端口'),
      field('username', '用户名'),
      field('password', '密码', true),
      field('from', '发件地址'),
      field('secure', '使用 SSL/TLS', false, false, [
        { value: 'true', label: '是' },
        { value: 'false', label: '否' },
      ]),
    ],
  },
  payment: {
    name: '支付服务',
    description: '支付渠道、回调和签名密钥',
    fields: [
      field('provider', '支付渠道', false, true, [
        { value: 'wechat_pay', label: '微信支付' },
        { value: 'alipay', label: '支付宝' },
        { value: 'stripe', label: 'Stripe' },
      ]),
      field('merchantId', '商户号'),
      field('apiKey', 'API Key', true),
      field('privateKey', '私钥', true),
      field('webhookSecret', '回调密钥', true),
    ],
  },
};
interface StoredConfig {
  enabled: boolean;
  values: Record<string, string>;
  secrets: Record<string, string>;
  updatedAt: string;
}
interface IntegrationAuditContext {
  actorId?: string;
  requestId?: string;
  ipAddress?: string;
}
const memory = new Map<IntegrationKind, StoredConfig>();
const moduleByKind: Record<IntegrationKind, keyof typeof project.modules | undefined> = {
  object_storage: 'objectStorage',
  sql: undefined,
  redis: 'redis',
  sms: 'sms',
  email: 'email',
  payment: 'payment',
};
const isAvailable = (kind: IntegrationKind): boolean => {
  const moduleName = moduleByKind[kind];
  return moduleName === undefined || project.modules[moduleName];
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  list(): Promise<IntegrationConfigSummary[]> {
    return Promise.all(
      (Object.keys(definitions) as IntegrationKind[])
        .filter(isAvailable)
        .map((kind) => this.get(kind)),
    );
  }
  async get(kind: IntegrationKind): Promise<IntegrationConfigSummary> {
    const definition = definitions[kind];
    if (!definition) throw new BadRequestException('INTEGRATION_KIND_INVALID');
    if (!isAvailable(kind)) throw new BadRequestException('INTEGRATION_MODULE_DISABLED');
    let stored: StoredConfig | undefined;
    if (process.env.DATA_SOURCE === 'prisma') {
      const row = await this.prisma.integrationConfig.findUnique({ where: { kind } });
      if (row)
        stored = {
          enabled: row.enabled,
          values: row.values as Record<string, string>,
          secrets: this.decrypt(row.encryptedSecrets),
          updatedAt: row.updatedAt.toISOString(),
        };
    } else stored = memory.get(kind);
    return {
      kind,
      ...definition,
      enabled: stored?.enabled ?? false,
      configured: Boolean(stored),
      values: stored?.values ?? {},
      configuredSecrets: Object.keys(stored?.secrets ?? {}),
      updatedAt: stored?.updatedAt ?? null,
    };
  }
  async update(
    kind: IntegrationKind,
    input: UpdateIntegrationConfigRequest,
    context: IntegrationAuditContext = {},
  ): Promise<IntegrationConfigSummary> {
    try {
      if (!definitions[kind]) throw new BadRequestException('INTEGRATION_KIND_INVALID');
      if (!isAvailable(kind)) throw new BadRequestException('INTEGRATION_MODULE_DISABLED');
      const current = await this.get(kind);
      this.validateInput(kind, input, new Set(current.configuredSecrets));
      const cleanSecrets = Object.fromEntries(
        Object.entries(input.secrets).filter(([, value]) => value),
      );
      if (process.env.DATA_SOURCE === 'prisma') {
        const old = await this.prisma.integrationConfig.findUnique({ where: { kind } });
        const secrets = { ...this.decrypt(old?.encryptedSecrets ?? null), ...cleanSecrets };
        await this.prisma.integrationConfig.upsert({
          where: { kind },
          create: {
            kind,
            enabled: input.enabled,
            values: input.values,
            encryptedSecrets: this.encrypt(secrets),
          },
          update: {
            enabled: input.enabled,
            values: input.values,
            encryptedSecrets: this.encrypt(secrets),
          },
        });
      } else {
        const old = memory.get(kind);
        memory.set(kind, {
          enabled: input.enabled,
          values: input.values,
          secrets: { ...(old?.secrets ?? {}), ...cleanSecrets },
          updatedAt: new Date().toISOString(),
        });
      }
      await this.audit.record({
        ...context,
        action: 'integration.update',
        resource: 'integration',
        resourceId: kind,
        result: 'success',
        metadata: {
          enabled: input.enabled,
          valueFields: Object.keys(input.values),
          secretFieldsChanged: Object.keys(cleanSecrets),
        },
      });
      return this.get(kind);
    } catch (error) {
      await this.audit
        .record({
          ...context,
          action: 'integration.update',
          resource: 'integration',
          resourceId: kind,
          result: 'failure',
          metadata: {
            enabled: input.enabled,
            valueFields: Object.keys(input.values),
            secretFieldsChanged: Object.keys(input.secrets).filter((key) =>
              Boolean(input.secrets[key]),
            ),
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }
  async runtimeConfig(kind: IntegrationKind): Promise<{
    enabled: boolean;
    values: Record<string, string>;
    secrets: Record<string, string>;
  }> {
    if (!isAvailable(kind)) return { enabled: false, values: {}, secrets: {} };
    if (process.env.DATA_SOURCE === 'prisma') {
      const row = await this.prisma.integrationConfig.findUnique({ where: { kind } });
      return {
        enabled: row?.enabled ?? false,
        values: (row?.values as Record<string, string> | undefined) ?? {},
        secrets: this.decrypt(row?.encryptedSecrets ?? null),
      };
    }
    const stored = memory.get(kind);
    return {
      enabled: stored?.enabled ?? false,
      values: stored?.values ?? {},
      secrets: stored?.secrets ?? {},
    };
  }
  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
      .digest();
  }
  private validateInput(
    kind: IntegrationKind,
    input: UpdateIntegrationConfigRequest,
    configuredSecrets: Set<string>,
  ): void {
    const fields = definitions[kind].fields,
      byKey = new Map(fields.map((item) => [item.key, item]));
    for (const [key, value] of Object.entries(input.values)) {
      const definition = byKey.get(key);
      if (!definition || definition.secret)
        throw new BadRequestException('INTEGRATION_FIELD_INVALID');
      if (typeof value !== 'string') throw new BadRequestException('INTEGRATION_FIELD_INVALID');
      if (definition.options && !definition.options.some((option) => option.value === value))
        throw new BadRequestException('INTEGRATION_OPTION_INVALID');
    }
    for (const [key, value] of Object.entries(input.secrets)) {
      const definition = byKey.get(key);
      if (!definition?.secret || typeof value !== 'string')
        throw new BadRequestException('INTEGRATION_SECRET_FIELD_INVALID');
    }
    if (!input.enabled) return;
    for (const definition of fields.filter((item) => item.required)) {
      const present = definition.secret
        ? Boolean(input.secrets[definition.key]?.trim()) || configuredSecrets.has(definition.key)
        : Boolean(input.values[definition.key]?.trim());
      if (!present) throw new BadRequestException('INTEGRATION_REQUIRED_FIELD_MISSING');
    }
  }
  private encrypt(value: Record<string, string>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }
  private decrypt(value: string | null): Record<string, string> {
    if (!value) return {};
    const raw = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'),
    ) as Record<string, string>;
  }
}
