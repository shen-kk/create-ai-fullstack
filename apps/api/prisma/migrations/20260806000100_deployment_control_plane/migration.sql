CREATE TYPE "DeploymentEnvironment" AS ENUM ('DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION', 'CUSTOM');
CREATE TYPE "DeploymentTargetStatus" AS ENUM ('DRAFT', 'VERIFIED', 'UNREACHABLE');
CREATE TYPE "DeploymentRunStatus" AS ENUM ('QUEUED', 'BUILDING', 'DEPLOYING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'ROLLED_BACK');

CREATE TABLE "DeploymentTarget" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "environment" "DeploymentEnvironment" NOT NULL,
  "applications" TEXT[],
  "host" TEXT NOT NULL,
  "sshPort" INTEGER NOT NULL DEFAULT 22,
  "sshUser" TEXT NOT NULL,
  "deployPath" TEXT NOT NULL,
  "accessMode" TEXT NOT NULL,
  "adminUrl" TEXT,
  "apiUrl" TEXT,
  "webUrl" TEXT,
  "cnbRepository" TEXT,
  "cnbEvent" TEXT NOT NULL DEFAULT 'api_trigger_deploy',
  "encryptedSecrets" TEXT,
  "status" "DeploymentTargetStatus" NOT NULL DEFAULT 'DRAFT',
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentRun" (
  "id" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "actorId" TEXT,
  "version" TEXT NOT NULL,
  "applications" TEXT[],
  "status" "DeploymentRunStatus" NOT NULL DEFAULT 'QUEUED',
  "currentStep" TEXT,
  "steps" JSONB NOT NULL,
  "cnbBuildId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DeploymentRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeploymentTarget_name_key" ON "DeploymentTarget"("name");
CREATE INDEX "DeploymentTarget_environment_updatedAt_idx" ON "DeploymentTarget"("environment", "updatedAt");
CREATE INDEX "DeploymentRun_targetId_createdAt_idx" ON "DeploymentRun"("targetId", "createdAt");
CREATE INDEX "DeploymentRun_status_createdAt_idx" ON "DeploymentRun"("status", "createdAt");

ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "DeploymentTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode", "createdAt") VALUES
  ('perm_menu_deployments', 'menu.deployments', '显示部署中心菜单', 'MENU', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_read', 'deployments.read', '查看部署环境与任务', 'ACTION', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_manage', 'deployments.manage', '配置部署环境与密钥', 'ACTION', 'deployments', CURRENT_TIMESTAMP),
  ('perm_deployments_execute', 'deployments.execute', '执行部署与回滚', 'ACTION', 'deployments', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'super_admin' AND p."code" IN (
  'menu.deployments', 'deployments.read', 'deployments.manage', 'deployments.execute'
)
ON CONFLICT DO NOTHING;
