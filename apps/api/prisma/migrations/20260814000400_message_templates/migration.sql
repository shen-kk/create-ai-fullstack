CREATE TABLE "MessageTemplate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "subject" TEXT,
  "textBody" TEXT,
  "htmlBody" TEXT,
  "providerTemplateId" TEXT,
  "parameterMapping" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageTemplate_code_key" ON "MessageTemplate"("code");
CREATE INDEX "MessageTemplate_channel_enabled_idx" ON "MessageTemplate"("channel", "enabled");
ALTER TABLE "ServiceFeatureBinding" ADD COLUMN "templateId" TEXT;
CREATE INDEX "ServiceFeatureBinding_templateId_idx" ON "ServiceFeatureBinding"("templateId");
ALTER TABLE "ServiceFeatureBinding" ADD CONSTRAINT "ServiceFeatureBinding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MessageTemplate" ("id", "code", "name", "channel", "subject", "textBody", "htmlBody", "providerTemplateId", "parameterMapping", "enabled", "system", "updatedAt") VALUES
('tpl_email_login', 'email_login', '登录验证码邮件', 'email', '{{projectName}} 登录验证码', '您的验证码是 {{code}}，{{minutes}} 分钟内有效，请勿转发。', NULL, NULL, '{"code":"{{code}}","minutes":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP),
('tpl_email_password_reset', 'email_password_reset', '找回密码邮件', 'email', '{{projectName}} 找回密码验证码', '您的验证码是 {{code}}，{{minutes}} 分钟内有效。如非本人操作，请忽略。', NULL, NULL, '{"code":"{{code}}","minutes":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP),
('tpl_email_bind_contact', 'email_bind_contact', '绑定邮箱邮件', 'email', '{{projectName}} 邮箱验证码', '您的验证码是 {{code}}，{{minutes}} 分钟内有效，请勿转发。', NULL, NULL, '{"code":"{{code}}","minutes":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP),
('tpl_sms_login', 'sms_login', '登录验证码短信', 'sms', NULL, NULL, NULL, NULL, '{"0":"{{code}}","1":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP),
('tpl_sms_password_reset', 'sms_password_reset', '找回密码短信', 'sms', NULL, NULL, NULL, NULL, '{"0":"{{code}}","1":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP),
('tpl_sms_bind_contact', 'sms_bind_contact', '绑定手机号短信', 'sms', NULL, NULL, NULL, NULL, '{"0":"{{code}}","1":"{{minutes}}"}', true, true, CURRENT_TIMESTAMP);

UPDATE "ServiceFeatureBinding" SET "templateId" = CASE "code"
  WHEN 'customer.email_login' THEN 'tpl_email_login'
  WHEN 'customer.email_password_reset' THEN 'tpl_email_password_reset'
  WHEN 'customer.email_bind_contact' THEN 'tpl_email_bind_contact'
  WHEN 'customer.sms_login' THEN 'tpl_sms_login'
  WHEN 'customer.sms_password_reset' THEN 'tpl_sms_password_reset'
  WHEN 'customer.sms_bind_contact' THEN 'tpl_sms_bind_contact'
  ELSE NULL END;
