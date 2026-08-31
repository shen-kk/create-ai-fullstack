import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  IntegrationConfigSummary,
  IntegrationField,
  IntegrationKind,
  ServiceResourceSummary,
  ServiceFeatureBindingSummary,
  DeleteServiceResourceResponse,
  CustomerAuthMode,
  CustomerAuthSettings,
  UpdateCustomerAuthSettingsRequest,
  ServiceFeatureCode,
  UpsertServiceResourceRequest,
  MessageTemplateSummary,
  UpsertMessageTemplateRequest,
  UpdateIntegrationConfigRequest,
} from '@template/contracts';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  encryptDeploymentSecrets,
  safeDecryptDeploymentSecrets,
} from '../deployments/deployment-secrets.js';

const field = (
  key: string,
  label: string,
  secret = false,
  required = true,
  options?: Array<{ value: string; label: string }>,
  providers?: string[],
): IntegrationField => ({
  key,
  label,
  secret,
  required,
  ...(options ? { options } : {}),
  ...(providers ? { providers } : {}),
});
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
    description: 'SMTP、腾讯云 SES 邮件推送和验证码',
    fields: [
      field('provider', '邮件平台', false, true, [
        { value: 'smtp', label: '通用 SMTP' },
        { value: 'tencent_ses', label: '腾讯云 SES（API）' },
      ]),
      field('host', 'SMTP 主机', false, true, undefined, ['smtp']),
      field('port', 'SMTP 端口', false, true, undefined, ['smtp']),
      field('username', 'SMTP 用户名', false, true, undefined, ['smtp']),
      field('password', 'SMTP 密码', true, true, undefined, ['smtp']),
      field('region', '区域', false, true, undefined, ['tencent_ses']),
      field('accessKeyId', 'SecretId', false, true, undefined, ['tencent_ses']),
      field('accessKeySecret', 'SecretKey', true, true, undefined, ['tencent_ses']),
      field('from', '发件地址', false, true, undefined, ['smtp', 'tencent_ses']),
      field('templateId', '验证码模板 ID', false, true, undefined, ['tencent_ses']),
      field(
        'secure',
        '使用 SSL/TLS',
        false,
        false,
        [
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ],
        ['smtp'],
      ),
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
  server: {
    name: '服务器',
    description: 'Linux SSH 部署服务器',
    fields: [
      field('host', '服务器 IP 或域名'),
      field('port', 'SSH 端口'),
      field('username', 'SSH 用户'),
      field('authMode', '认证方式', false, true, [
        { value: 'private_key', label: 'SSH 私钥' },
        { value: 'password', label: 'SSH 密码' },
      ]),
      field('deployRoot', '默认部署根目录'),
      field('password', 'SSH 密码', true, false),
      field('privateKey', 'SSH 私钥', true, false),
    ],
  },
  git: {
    name: 'Git 仓库',
    description: '部署使用的代码仓库与访问凭据',
    fields: [
      field('repositoryUrl', '仓库地址'),
      field('defaultRef', '默认分支或 Tag'),
      field('authMode', '认证方式', false, true, [
        { value: 'none', label: '公开仓库' },
        { value: 'token', label: 'HTTPS 令牌' },
        { value: 'ssh_key', label: 'SSH 私钥' },
      ]),
      field('token', '访问令牌', true, false),
      field('privateKey', 'SSH 私钥', true, false),
    ],
  },
};
const featureDefinitions: Record<
  ServiceFeatureCode,
  {
    groupCode: 'common' | 'customer_auth';
    groupName: string;
    name: string;
    description: string;
    requiredKind: IntegrationKind;
  }
> = {
  'admin.avatar_upload': {
    groupCode: 'common',
    groupName: '公共功能',
    name: '后台管理员头像上传',
    description: '后台个人中心上传管理员头像',
    requiredKind: 'object_storage',
  },
  'customer.avatar_upload': {
    groupCode: 'common',
    groupName: '公共功能',
    name: '用户端头像上传',
    description: '用户端个人中心上传头像',
    requiredKind: 'object_storage',
  },
  'customer.email_login': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '用户登录邮件',
    description: '邮箱验证码登录',
    requiredKind: 'email',
  },
  'customer.email_password_reset': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '找回密码邮件',
    description: '通过邮箱找回密码',
    requiredKind: 'email',
  },
  'customer.email_bind_contact': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '绑定邮箱邮件',
    description: '用户绑定或更换邮箱',
    requiredKind: 'email',
  },
  'customer.sms_login': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '用户登录短信',
    description: '短信验证码登录',
    requiredKind: 'sms',
  },
  'customer.sms_password_reset': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '找回密码短信',
    description: '通过短信找回密码',
    requiredKind: 'sms',
  },
  'customer.sms_bind_contact': {
    groupCode: 'customer_auth',
    groupName: '用户端认证',
    name: '绑定手机号短信',
    description: '用户绑定或更换手机号',
    requiredKind: 'sms',
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
const isAvailable = (kind: IntegrationKind): boolean => {
  void kind;
  return true;
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
        .map((kind) => this.getResourceTypeSummary(kind)),
    );
  }
  private async getResourceTypeSummary(kind: IntegrationKind): Promise<IntegrationConfigSummary> {
    const definition = definitions[kind];
    const resource = await this.prisma.serviceResource.findFirst({
      where: { kind, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      kind,
      ...definition,
      enabled: Boolean(resource),
      configured: Boolean(resource),
      values: (resource?.values as Record<string, string> | undefined) ?? {},
      // Listing configuration must remain available even when an old database
      // was bootstrapped with a different encryption key. Secrets are omitted
      // until the administrator re-enters them with the current key.
      configuredSecrets: resource ? Object.keys(this.safeDecrypt(resource.encryptedSecrets)) : [],
      updatedAt: resource?.updatedAt.toISOString() ?? null,
    };
  }
  async listResources(kind?: IntegrationKind): Promise<ServiceResourceSummary[]> {
    const rows = await this.prisma.serviceResource.findMany({
      ...(kind ? { where: { kind } } : {}),
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as IntegrationKind,
      provider: row.provider,
      enabled: row.enabled,
      values: row.values as Record<string, string>,
      configuredSecrets: Object.keys(this.safeDecrypt(row.encryptedSecrets)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
  async createResource(input: UpsertServiceResourceRequest): Promise<ServiceResourceSummary> {
    this.validateResourceShape(input);
    this.validateInput(input.kind, input, new Set());
    this.validateConditionalSecrets(input.kind, input.values, input.secrets, new Set());
    const row = await this.prisma.serviceResource.create({
      data: {
        name: input.name.trim(),
        kind: input.kind,
        provider: input.provider.trim() || input.kind,
        enabled: input.enabled,
        values: input.values,
        encryptedSecrets: this.encrypt(input.secrets),
      },
    });
    return (await this.listResources()).find((item) => item.id === row.id)!;
  }
  async updateResource(
    id: string,
    input: UpsertServiceResourceRequest,
  ): Promise<ServiceResourceSummary> {
    this.validateResourceShape(input);
    const current = await this.prisma.serviceResource.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('SERVICE_RESOURCE_NOT_FOUND');
    if (current.kind !== input.kind)
      throw new BadRequestException('SERVICE_RESOURCE_KIND_IMMUTABLE');
    const readableSecrets = this.safeDecrypt(current.encryptedSecrets);
    const configuredSecrets = new Set(Object.keys(readableSecrets));
    this.validateInput(input.kind, input, configuredSecrets);
    this.validateConditionalSecrets(input.kind, input.values, input.secrets, configuredSecrets);
    const secrets = {
      ...readableSecrets,
      ...Object.fromEntries(Object.entries(input.secrets).filter(([, value]) => value)),
    };
    await this.prisma.$transaction(async (transaction) => {
      await transaction.serviceResource.update({
        where: { id },
        data: {
          name: input.name.trim(),
          provider: input.provider,
          enabled: input.enabled,
          values: input.values,
          encryptedSecrets: this.encrypt(secrets),
        },
      });
      if (input.kind === 'git') {
        const environments = await transaction.deployEnvironment.findMany({
          where: { gitResourceId: id },
          select: { id: true, encryptedSecrets: true },
        });
        const values = input.values;
        await Promise.all(
          environments.map((environment) => {
            const deploymentSecrets = safeDecryptDeploymentSecrets(environment.encryptedSecrets);
            if (secrets.token) deploymentSecrets.gitToken = secrets.token;
            else delete deploymentSecrets.gitToken;
            if (secrets.privateKey) deploymentSecrets.gitSshPrivateKey = secrets.privateKey;
            else delete deploymentSecrets.gitSshPrivateKey;
            return transaction.deployEnvironment.update({
              where: { id: environment.id },
              data: {
                ...(input.enabled
                  ? {
                      repositoryUrl: values.repositoryUrl ?? '',
                      gitRef: values.defaultRef ?? '',
                      gitAuthMode: values.authMode ?? '',
                    }
                  : {}),
                encryptedSecrets: encryptDeploymentSecrets(deploymentSecrets),
                status: 'DRAFT',
                gitVerifiedAt: null,
                lastVerifiedAt: null,
              },
            });
          }),
        );
      }
      if (input.kind === 'server') {
        const environments = await transaction.deployEnvironment.findMany({
          where: { serverResourceId: id },
          select: { id: true, encryptedSecrets: true },
        });
        const values = input.values;
        await Promise.all(
          environments.map((environment) => {
            const deploymentSecrets = safeDecryptDeploymentSecrets(environment.encryptedSecrets);
            if (secrets.password) deploymentSecrets.sshPassword = secrets.password;
            else delete deploymentSecrets.sshPassword;
            if (secrets.privateKey) deploymentSecrets.sshPrivateKey = secrets.privateKey;
            else delete deploymentSecrets.sshPrivateKey;
            return transaction.deployEnvironment.update({
              where: { id: environment.id },
              data: {
                ...(input.enabled
                  ? {
                      host: values.host ?? '',
                      sshPort: Number(values.port || 22),
                      sshUser: values.username ?? '',
                      sshAuthMode: values.authMode ?? '',
                    }
                  : {}),
                encryptedSecrets: encryptDeploymentSecrets(deploymentSecrets),
                status: 'DRAFT',
                serverVerifiedAt: null,
                lastVerifiedAt: null,
              },
            });
          }),
        );
      }
      if (input.kind === 'sql' || input.kind === 'redis') {
        const bindingField = input.kind === 'sql' ? 'sqlResourceId' : 'redisResourceId';
        const environments = await transaction.deployEnvironment.findMany({
          where: { [bindingField]: id },
          select: { id: true, encryptedSecrets: true },
        });
        await Promise.all(
          environments.map((environment) => {
            const deploymentSecrets = safeDecryptDeploymentSecrets(environment.encryptedSecrets);
            if (input.enabled && input.kind === 'sql') {
              deploymentSecrets.databaseUrl = this.databaseUrl(input.values, secrets);
            } else if (input.enabled) {
              deploymentSecrets.redisUrl = this.redisUrl(input.values, secrets);
            }
            return transaction.deployEnvironment.update({
              where: { id: environment.id },
              data: {
                encryptedSecrets: encryptDeploymentSecrets(deploymentSecrets),
                status: 'DRAFT',
                gitVerifiedAt: null,
                serverVerifiedAt: null,
                lastVerifiedAt: null,
              },
            });
          }),
        );
      }
    });
    return (await this.listResources()).find((item) => item.id === id)!;
  }
  private databaseUrl(values: Record<string, string>, secrets: Record<string, string>): string {
    if (values.url) return values.url;
    const engine = values.engine === 'postgresql' ? 'postgresql' : values.engine;
    return `${engine}://${encodeURIComponent(values.username ?? '')}:${encodeURIComponent(secrets.password ?? '')}@${values.host}:${values.port}/${encodeURIComponent(values.database ?? '')}?schema=${encodeURIComponent(values.schema || 'public')}`;
  }
  private redisUrl(values: Record<string, string>, secrets: Record<string, string>): string {
    let target: URL;
    try {
      target = new URL(values.url ?? '');
    } catch {
      throw new BadRequestException('DEPLOYMENT_REDIS_URL_INVALID');
    }
    if (secrets.password) target.password = secrets.password;
    else target.password = '';
    return target.toString();
  }
  async getResourceSecrets(
    id: string,
    context: IntegrationAuditContext,
  ): Promise<Record<string, string>> {
    const resource = await this.prisma.serviceResource.findUnique({ where: { id } });
    if (!resource) throw new BadRequestException('SERVICE_RESOURCE_NOT_FOUND');
    try {
      const secrets = this.requiredDecrypt(resource.encryptedSecrets);
      await this.audit.record({
        ...context,
        action: 'integration.secret.read',
        resource: 'integration',
        resourceId: id,
        result: 'success',
        metadata: { kind: resource.kind, secretFields: Object.keys(secrets) },
      });
      return secrets;
    } catch (error) {
      await this.audit.record({
        ...context,
        action: 'integration.secret.read',
        resource: 'integration',
        resourceId: id,
        result: 'failure',
        metadata: { kind: resource.kind },
      });
      throw error;
    }
  }
  async deleteResource(
    id: string,
    context: IntegrationAuditContext,
  ): Promise<DeleteServiceResourceResponse> {
    const resource = await this.prisma.serviceResource.findUnique({ where: { id } });
    if (!resource) throw new BadRequestException('SERVICE_RESOURCE_NOT_FOUND');
    const [featureBindingCount, deploymentCount] = await Promise.all([
      this.prisma.serviceFeatureBinding.count({ where: { resourceId: id } }),
      this.prisma.deployEnvironment.count({
        where: {
          OR: [
            { serverResourceId: id },
            { gitResourceId: id },
            { sqlResourceId: id },
            { redisResourceId: id },
          ],
        },
      }),
    ]);
    if (featureBindingCount > 0) throw new BadRequestException('SERVICE_RESOURCE_BOUND_TO_FEATURE');
    if (deploymentCount > 0) throw new BadRequestException('SERVICE_RESOURCE_BOUND_TO_DEPLOYMENT');
    await this.prisma.serviceResource.delete({ where: { id } });
    await this.audit.record({
      action: 'integration.resource.delete',
      resource: 'integration',
      resourceId: id,
      result: 'success',
      metadata: { kind: resource.kind, name: resource.name },
      ...context,
    });
    return { id };
  }
  async getCustomerAuthSettings(): Promise<CustomerAuthSettings> {
    const setting = await this.prisma.customerAuthSetting.findUnique({ where: { id: 1 } });
    const mode = (setting?.mode ?? 'phone') as CustomerAuthMode;
    return {
      mode,
      availableChannels: [mode === 'phone' ? 'sms' : 'email'],
      verificationTtlSeconds: setting?.verificationTtlSeconds ?? 300,
      verificationRetrySeconds: setting?.verificationRetrySeconds ?? 60,
      updatedAt: setting?.updatedAt.toISOString() ?? null,
    };
  }
  async assertCustomerAuthChannel(channel: 'sms' | 'email'): Promise<void> {
    const settings = await this.getCustomerAuthSettings();
    if (!settings.availableChannels.includes(channel))
      throw new BadRequestException('CUSTOMER_AUTH_CHANNEL_DISABLED');
  }
  async updateCustomerAuthSettings(
    input: UpdateCustomerAuthSettingsRequest,
  ): Promise<CustomerAuthSettings> {
    const { mode, verificationTtlSeconds, verificationRetrySeconds } = input;
    if (!['phone', 'email'].includes(mode))
      throw new BadRequestException('CUSTOMER_AUTH_MODE_INVALID');
    const channels = [mode === 'phone' ? 'sms' : 'email'];
    const requiredCodes = channels.flatMap((channel) => [
      `customer.${channel}_login`,
      `customer.${channel}_password_reset`,
    ]);
    const configured = await this.prisma.serviceFeatureBinding.count({
      where: {
        code: { in: requiredCodes },
        resource: { enabled: true },
        template: { enabled: true },
      },
    });
    if (configured !== requiredCodes.length)
      throw new BadRequestException('CUSTOMER_AUTH_FEATURE_BINDINGS_INCOMPLETE');
    await this.prisma.customerAuthSetting.upsert({
      where: { id: 1 },
      create: { id: 1, mode, verificationTtlSeconds, verificationRetrySeconds },
      update: { mode, verificationTtlSeconds, verificationRetrySeconds },
    });
    return this.getCustomerAuthSettings();
  }
  async listFeatureBindings(): Promise<ServiceFeatureBindingSummary[]> {
    const bindings = await this.prisma.serviceFeatureBinding.findMany({
      include: { resource: true, template: true },
    });
    const byCode = new Map(bindings.map((binding) => [binding.code, binding]));
    return (Object.keys(featureDefinitions) as ServiceFeatureCode[]).map((code) => {
      const definition = featureDefinitions[code];
      const binding = byCode.get(code);
      return {
        code,
        ...definition,
        resourceId: binding?.resourceId ?? null,
        resourceName: binding?.resource.name ?? null,
        templateId: binding?.templateId ?? null,
        templateName: binding?.template?.name ?? null,
        enabled: binding?.resource.enabled ?? false,
        updatedAt: binding?.updatedAt.toISOString() ?? null,
      };
    });
  }
  async updateFeatureBinding(
    code: ServiceFeatureCode,
    resourceId: string | null,
    templateId?: string | null,
  ): Promise<ServiceFeatureBindingSummary> {
    const definition = featureDefinitions[code];
    if (!definition) throw new BadRequestException('SERVICE_FEATURE_INVALID');
    if (!resourceId) await this.prisma.serviceFeatureBinding.deleteMany({ where: { code } });
    else {
      const resource = await this.prisma.serviceResource.findUnique({ where: { id: resourceId } });
      if (!resource) throw new BadRequestException('SERVICE_RESOURCE_NOT_FOUND');
      if (resource.kind !== definition.requiredKind)
        throw new BadRequestException('SERVICE_FEATURE_RESOURCE_KIND_MISMATCH');
      if (!resource.enabled) throw new BadRequestException('SERVICE_RESOURCE_DISABLED');
      let resolvedTemplateId = templateId;
      if (definition.requiredKind === 'email' || definition.requiredKind === 'sms') {
        if (resolvedTemplateId === undefined) {
          const current = await this.prisma.serviceFeatureBinding.findUnique({ where: { code } });
          resolvedTemplateId = current?.templateId ?? null;
        }
        if (resolvedTemplateId) {
          const template = await this.prisma.messageTemplate.findUnique({
            where: { id: resolvedTemplateId },
          });
          if (!template || template.channel !== definition.requiredKind || !template.enabled)
            throw new BadRequestException('MESSAGE_TEMPLATE_INVALID');
        }
      } else resolvedTemplateId = null;
      await this.prisma.serviceFeatureBinding.upsert({
        where: { code },
        create: { code, resourceId, templateId: resolvedTemplateId ?? null },
        update: { resourceId, templateId: resolvedTemplateId ?? null },
      });
    }
    return (await this.listFeatureBindings()).find((item) => item.code === code)!;
  }
  async listMessageTemplates(): Promise<MessageTemplateSummary[]> {
    const rows = await this.prisma.messageTemplate.findMany({
      orderBy: [{ channel: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.messageTemplateSummary(row));
  }
  async createMessageTemplate(
    input: UpsertMessageTemplateRequest,
  ): Promise<MessageTemplateSummary> {
    this.validateMessageTemplate(input);
    const row = await this.prisma.messageTemplate.create({ data: { ...input, system: false } });
    return this.messageTemplateSummary(row);
  }
  async updateMessageTemplate(
    id: string,
    input: UpsertMessageTemplateRequest,
  ): Promise<MessageTemplateSummary> {
    this.validateMessageTemplate(input);
    const current = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('MESSAGE_TEMPLATE_NOT_FOUND');
    const row = await this.prisma.messageTemplate.update({ where: { id }, data: input });
    return this.messageTemplateSummary(row);
  }
  async deleteMessageTemplate(id: string): Promise<{ id: string }> {
    const count = await this.prisma.serviceFeatureBinding.count({ where: { templateId: id } });
    if (count) throw new BadRequestException('MESSAGE_TEMPLATE_IN_USE');
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { id };
  }
  async get(kind: IntegrationKind): Promise<IntegrationConfigSummary> {
    const definition = definitions[kind];
    if (!definition) throw new BadRequestException('INTEGRATION_KIND_INVALID');
    if (!isAvailable(kind)) throw new BadRequestException('INTEGRATION_MODULE_DISABLED');
    const row = await this.prisma.integrationConfig.findUnique({ where: { kind } });
    const stored: StoredConfig | undefined = row
      ? {
          enabled: row.enabled,
          values: row.values as Record<string, string>,
          secrets: this.safeDecrypt(row.encryptedSecrets),
          updatedAt: row.updatedAt.toISOString(),
        }
      : undefined;
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
      const old = await this.prisma.integrationConfig.findUnique({ where: { kind } });
      // An existing resource may have been encrypted with a previous project
      // key. Keep only values that can be decrypted; newly supplied secrets
      // are re-encrypted with the current key on save.
      const secrets = { ...this.safeDecrypt(old?.encryptedSecrets ?? null), ...cleanSecrets };
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
  async runtimeConfig(
    kind: IntegrationKind,
    featureCode?: ServiceFeatureCode,
  ): Promise<{
    enabled: boolean;
    values: Record<string, string>;
    secrets: Record<string, string>;
    template?: MessageTemplateSummary;
  }> {
    if (!isAvailable(kind)) return { enabled: false, values: {}, secrets: {} };
    if (featureCode) {
      const definition = featureDefinitions[featureCode];
      if (!definition || definition.requiredKind !== kind)
        throw new BadRequestException('SERVICE_FEATURE_RESOURCE_KIND_MISMATCH');
      const binding = await this.prisma.serviceFeatureBinding.findUnique({
        where: { code: featureCode },
        include: { resource: true, template: true },
      });
      if (binding?.resource.enabled)
        return {
          enabled: true,
          values: binding.resource.values as Record<string, string>,
          secrets: this.requiredDecrypt(binding.resource.encryptedSecrets),
          ...(binding.template ? { template: this.messageTemplateSummary(binding.template) } : {}),
        };
      return { enabled: false, values: {}, secrets: {} };
    }
    const stored = await this.prisma.integrationConfig.findUnique({ where: { kind } });
    if (!stored) {
      const resource = await this.prisma.serviceResource.findFirst({
        where: { kind, enabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (resource)
        return {
          enabled: true,
          values: resource.values as Record<string, string>,
          secrets: this.requiredDecrypt(resource.encryptedSecrets),
        };
    }
    return {
      enabled: stored?.enabled ?? false,
      values: (stored?.values as Record<string, string> | undefined) ?? {},
      secrets: this.requiredDecrypt(stored?.encryptedSecrets ?? null),
    };
  }
  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
      .digest();
  }
  private messageTemplateSummary(row: {
    id: string;
    code: string;
    name: string;
    channel: string;
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    providerTemplateId: string | null;
    parameterMapping: unknown;
    enabled: boolean;
    system: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): MessageTemplateSummary {
    return {
      ...row,
      channel: row.channel as 'email' | 'sms',
      parameterMapping: row.parameterMapping as Record<string, string>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private validateMessageTemplate(input: UpsertMessageTemplateRequest): void {
    const allowed = new Set(['code', 'minutes', 'projectName', 'purpose']);
    const sources = [
      input.subject,
      input.textBody,
      input.htmlBody,
      ...Object.values(input.parameterMapping),
    ].filter(Boolean) as string[];
    for (const source of sources)
      for (const match of source.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g))
        if (!allowed.has(match[1] ?? ''))
          throw new BadRequestException('MESSAGE_TEMPLATE_VARIABLE_INVALID');
    if (input.channel === 'email' && !input.subject?.trim())
      throw new BadRequestException('MESSAGE_TEMPLATE_SUBJECT_REQUIRED');
    if (
      input.channel === 'email' &&
      !input.textBody?.includes('{{code}}') &&
      !input.htmlBody?.includes('{{code}}') &&
      !input.providerTemplateId
    )
      throw new BadRequestException('MESSAGE_TEMPLATE_CODE_REQUIRED');
    if (input.htmlBody && /<script\b|\son[a-z]+\s*=|javascript:/i.test(input.htmlBody))
      throw new BadRequestException('MESSAGE_TEMPLATE_HTML_UNSAFE');
  }
  private validateResourceShape(input: UpsertServiceResourceRequest): void {
    if (
      !input ||
      !definitions[input.kind] ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      typeof input.provider !== 'string' ||
      typeof input.enabled !== 'boolean' ||
      !input.values ||
      typeof input.values !== 'object' ||
      !input.secrets ||
      typeof input.secrets !== 'object'
    )
      throw new BadRequestException('SERVICE_RESOURCE_INVALID');
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
    if (kind === 'server') {
      const deployRoot = input.values.deployRoot?.trim() ?? '';
      if (!deployRoot.startsWith('/') || deployRoot.includes('..'))
        throw new BadRequestException('SERVICE_DEPLOY_ROOT_INVALID');
    }
    const provider = input.values.provider ?? '';
    for (const definition of fields.filter(
      (item) => item.required && (!item.providers?.length || item.providers.includes(provider)),
    )) {
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
  private validateConditionalSecrets(
    kind: IntegrationKind,
    values: Record<string, string>,
    secrets: Record<string, string>,
    configuredSecrets: Set<string>,
  ): void {
    if (kind !== 'server' && kind !== 'git') return;
    const authMode = values.authMode;
    const key =
      authMode === 'password'
        ? 'password'
        : authMode === 'token'
          ? 'token'
          : authMode === 'private_key' || authMode === 'ssh_key'
            ? 'privateKey'
            : undefined;
    if (key && !secrets[key]?.trim() && !configuredSecrets.has(key))
      throw new BadRequestException('INTEGRATION_AUTH_CREDENTIAL_REQUIRED');
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
  private safeDecrypt(value: string | null): Record<string, string> {
    try {
      return this.decrypt(value);
    } catch {
      return {};
    }
  }
  private requiredDecrypt(value: string | null): Record<string, string> {
    try {
      return this.decrypt(value);
    } catch {
      throw new BadRequestException('INTEGRATION_SECRETS_REENTRY_REQUIRED');
    }
  }
}
