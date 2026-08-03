CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "passwordHash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerRefreshSession" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE INDEX "Customer_status_createdAt_idx" ON "Customer"("status", "createdAt");
CREATE UNIQUE INDEX "CustomerRefreshSession_tokenHash_key" ON "CustomerRefreshSession"("tokenHash");
CREATE INDEX "CustomerRefreshSession_customerId_expiresAt_idx" ON "CustomerRefreshSession"("customerId", "expiresAt");
ALTER TABLE "CustomerRefreshSession" ADD CONSTRAINT "CustomerRefreshSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
