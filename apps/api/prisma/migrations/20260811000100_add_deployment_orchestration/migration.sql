CREATE TYPE "DeployEnvironmentKind" AS ENUM ('DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION', 'CUSTOM');
CREATE TYPE "DeployEnvironmentStatus" AS ENUM ('DRAFT', 'VERIFIED', 'UNREACHABLE');
CREATE TYPE "DeployRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'ROLLING_BACK', 'ROLLED_BACK');
CREATE TYPE "DeployStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

CREATE TABLE "DeployEnvironment" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" "DeployEnvironmentKind" NOT NULL, "applications" TEXT[], "gitProvider" TEXT NOT NULL, "repositoryUrl" TEXT NOT NULL, "gitRef" TEXT NOT NULL DEFAULT 'main', "gitAuthMode" TEXT NOT NULL, "host" TEXT NOT NULL, "sshPort" INTEGER NOT NULL DEFAULT 22, "sshUser" TEXT NOT NULL, "sshAuthMode" TEXT NOT NULL, "deployPath" TEXT NOT NULL, "adminUrl" TEXT, "apiUrl" TEXT, "webUrl" TEXT, "healthCheckUrl" TEXT, "retainReleases" INTEGER NOT NULL DEFAULT 5, "encryptedSecrets" TEXT, "status" "DeployEnvironmentStatus" NOT NULL DEFAULT 'DRAFT', "gitVerifiedAt" TIMESTAMP(3), "serverVerifiedAt" TIMESTAMP(3), "lastVerifiedAt" TIMESTAMP(3), "currentReleaseId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "DeployEnvironment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeployRun" ("id" TEXT NOT NULL, "environmentId" TEXT NOT NULL, "actorId" TEXT, "gitRef" TEXT NOT NULL, "commitSha" TEXT, "applications" TEXT[], "status" "DeployRunStatus" NOT NULL DEFAULT 'QUEUED', "progress" INTEGER NOT NULL DEFAULT 0, "currentStep" TEXT, "errorCode" TEXT, "errorMessage" TEXT, "releaseId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), CONSTRAINT "DeployRun_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeployStep" ("id" TEXT NOT NULL, "runId" TEXT NOT NULL, "key" TEXT NOT NULL, "label" TEXT NOT NULL, "position" INTEGER NOT NULL, "status" "DeployStepStatus" NOT NULL DEFAULT 'PENDING', "progress" INTEGER NOT NULL DEFAULT 0, "message" TEXT, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), CONSTRAINT "DeployStep_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeployLog" ("id" TEXT NOT NULL, "runId" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "level" TEXT NOT NULL, "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DeployLog_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeployRelease" ("id" TEXT NOT NULL, "environmentId" TEXT NOT NULL, "version" TEXT NOT NULL, "commitSha" TEXT NOT NULL, "applications" TEXT[], "artifactHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DeployRelease_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "DeployEnvironment_name_key" ON "DeployEnvironment"("name");
CREATE INDEX "DeployEnvironment_kind_updatedAt_idx" ON "DeployEnvironment"("kind", "updatedAt");
CREATE INDEX "DeployRun_environmentId_createdAt_idx" ON "DeployRun"("environmentId", "createdAt");
CREATE INDEX "DeployRun_status_createdAt_idx" ON "DeployRun"("status", "createdAt");
CREATE UNIQUE INDEX "DeployStep_runId_key_key" ON "DeployStep"("runId", "key");
CREATE INDEX "DeployStep_runId_position_idx" ON "DeployStep"("runId", "position");
CREATE UNIQUE INDEX "DeployLog_runId_sequence_key" ON "DeployLog"("runId", "sequence");
CREATE INDEX "DeployLog_runId_sequence_idx" ON "DeployLog"("runId", "sequence");
CREATE UNIQUE INDEX "DeployRelease_environmentId_version_key" ON "DeployRelease"("environmentId", "version");
CREATE INDEX "DeployRelease_environmentId_createdAt_idx" ON "DeployRelease"("environmentId", "createdAt");

ALTER TABLE "DeployRun" ADD CONSTRAINT "DeployRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "DeployEnvironment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeployRun" ADD CONSTRAINT "DeployRun_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeployStep" ADD CONSTRAINT "DeployStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeployRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeployLog" ADD CONSTRAINT "DeployLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeployRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeployRelease" ADD CONSTRAINT "DeployRelease_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "DeployEnvironment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode", "createdAt") VALUES
  ('perm_menu_deployments_v2', 'menu.deployments', '显示部署中心菜单', 'MENU', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_read_v2', 'deployments.read', '查看部署环境、任务与日志', 'ACTION', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_manage_v2', 'deployments.manage', '管理部署环境和加密凭据', 'ACTION', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_execute_v2', 'deployments.execute', '执行或取消部署', 'ACTION', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_rollback_v2', 'deployments.rollback', '回滚到历史成功版本', 'ACTION', 'deployments', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description", "type" = EXCLUDED."type", "groupCode" = EXCLUDED."groupCode";

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."code" = 'super_admin' AND permission."code" IN ('menu.deployments', 'deployments.read', 'deployments.manage', 'deployments.execute', 'deployments.rollback')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
