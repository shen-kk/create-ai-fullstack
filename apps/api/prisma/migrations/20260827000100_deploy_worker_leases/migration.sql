ALTER TABLE "DeployRun"
ADD COLUMN "workerId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DeployRelease" ADD COLUMN "executionSnapshot" JSONB;

CREATE INDEX "DeployRun_status_leaseExpiresAt_idx"
ON "DeployRun"("status", "leaseExpiresAt");

CREATE INDEX "DeployRun_workerId_status_idx"
ON "DeployRun"("workerId", "status");

CREATE UNIQUE INDEX "DeployRun_one_active_per_environment"
ON "DeployRun"("environmentId")
WHERE "status" IN ('QUEUED', 'RUNNING', 'ROLLING_BACK');

CREATE TABLE "DeployWorker" (
  "id" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "processId" INTEGER NOT NULL,
  "version" TEXT NOT NULL,
  "currentRunId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeployWorker_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeployWorker_lastHeartbeatAt_idx" ON "DeployWorker"("lastHeartbeatAt");
