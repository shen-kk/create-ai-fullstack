UPDATE "CustomerAuthSetting" SET "mode" = 'phone' WHERE "mode" = 'both';
DELETE FROM "ServiceFeatureBinding" WHERE "code" IN ('customer.email_register', 'customer.sms_register');
