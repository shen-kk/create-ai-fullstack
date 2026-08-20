CREATE TABLE "ServiceFeatureBinding" (
  "code" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceFeatureBinding_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "ServiceFeatureBinding_resourceId_idx" ON "ServiceFeatureBinding"("resourceId");
ALTER TABLE "ServiceFeatureBinding" ADD CONSTRAINT "ServiceFeatureBinding_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "ServiceResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
