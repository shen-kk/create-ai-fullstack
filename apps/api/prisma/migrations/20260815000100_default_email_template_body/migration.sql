UPDATE "MessageTemplate"
SET
  "htmlBody" = '<h2>{{projectName}} 验证码</h2><p>您好：</p><p>您正在进行<strong>{{purpose}}</strong>操作，本次验证码为：</p><blockquote><strong>{{code}}</strong></blockquote><p>验证码将在 {{minutes}} 分钟内有效，请勿告知他人。</p><p>如非本人操作，请忽略此邮件。</p>',
  "textBody" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "channel" = 'email' AND ("htmlBody" IS NULL OR BTRIM("htmlBody") = '');
