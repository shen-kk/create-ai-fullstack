ALTER TABLE "VerificationCode"
  ADD COLUMN "targetMasked" TEXT NOT NULL DEFAULT '***',
  ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN "failureCode" TEXT;
