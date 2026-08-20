ALTER TABLE "DeployEnvironment"
ADD COLUMN "serverResourceId" TEXT,
ADD COLUMN "gitResourceId" TEXT,
ADD COLUMN "sqlResourceId" TEXT,
ADD COLUMN "redisResourceId" TEXT;

CREATE TABLE "ServiceResource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "values" JSONB NOT NULL,
  "encryptedSecrets" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceResource_kind_name_key" ON "ServiceResource"("kind", "name");
CREATE INDEX "ServiceResource_kind_enabled_idx" ON "ServiceResource"("kind", "enabled");
