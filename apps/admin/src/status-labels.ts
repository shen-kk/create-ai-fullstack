export const auditResultLabel = (value: string): string =>
  ({ success: '成功', failure: '失败' })[value] ?? '未知结果';

export const verificationStatusLabel = (value: string): string =>
  ({ sent: '已发送', consumed: '已验证', failed: '发送失败', expired: '已过期' })[value] ??
  '未知状态';

export const integrationErrorLabel = (value: string): string =>
  ({
    SMS_DELIVERY_FAILED: '短信发送失败',
    EMAIL_DELIVERY_FAILED: '邮件发送失败',
    SMS_CONFIG_INCOMPLETE: '短信配置不完整',
    EMAIL_CONFIG_INCOMPLETE: '邮件配置不完整',
    SMTP_TLS_REQUIRED: '邮件服务必须启用 TLS',
    SMS_PROVIDER_ADAPTER_REQUIRED: '短信服务商适配器未安装',
    EMAIL_PROVIDER_ADAPTER_REQUIRED: '邮件服务商适配器未安装',
  })[value] ?? '服务发送异常';
