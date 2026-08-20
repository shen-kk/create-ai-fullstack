ALTER TABLE "CustomerAuthSetting"
ADD COLUMN "verificationTtlSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN "verificationRetrySeconds" INTEGER NOT NULL DEFAULT 60;
