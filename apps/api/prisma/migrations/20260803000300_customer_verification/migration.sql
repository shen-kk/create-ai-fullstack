ALTER TABLE "Customer" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3), ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "VerificationCode" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "targetHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationCode_targetHash_purpose_createdAt_idx" ON "VerificationCode"("targetHash", "purpose", "createdAt");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
