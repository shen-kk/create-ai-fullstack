CREATE TABLE "DeployProject" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'docker-compose',
  "composeFile" TEXT NOT NULL DEFAULT 'docker-compose.production.yml',
  "units" JSONB NOT NULL,
  "variables" JSONB NOT NULL,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeployProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeployProject_name_key" ON "DeployProject"("name");
CREATE UNIQUE INDEX "DeployProject_code_key" ON "DeployProject"("code");
CREATE INDEX "DeployProject_updatedAt_idx" ON "DeployProject"("updatedAt");

INSERT INTO "DeployProject" (
  "id", "name", "code", "description", "units", "variables", "system", "version"
) VALUES (
  'system-aiforge-fullstack',
  'AIForge 全栈项目',
  'aiforge-fullstack',
  '由模板初始化生成的 Admin、API 与 Web Docker Compose 部署预设。',
  '[{"key":"admin","name":"后台管理","service":"admin","migrationCommand":null,"healthCheckUrl":null},{"key":"api","name":"API 服务","service":"api","migrationCommand":"./node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma","healthCheckUrl":"/api/health/ready"},{"key":"web","name":"用户端","service":"web","migrationCommand":null,"healthCheckUrl":null}]'::jsonb,
  '[{"key":"DATABASE_URL","label":"数据库连接","required":true,"secret":true,"resourceKind":"sql"},{"key":"REDIS_URL","label":"Redis 连接","required":false,"secret":true,"resourceKind":"redis"},{"key":"JWT_ACCESS_SECRET","label":"后台 Access Token 密钥","required":true,"secret":true,"resourceKind":null},{"key":"JWT_REFRESH_SECRET","label":"后台 Refresh Token 密钥","required":true,"secret":true,"resourceKind":null},{"key":"CONFIG_ENCRYPTION_KEY","label":"服务配置加密密钥","required":true,"secret":true,"resourceKind":null},{"key":"CUSTOMER_JWT_ACCESS_SECRET","label":"用户端 Access Token 密钥","required":true,"secret":true,"resourceKind":null},{"key":"CUSTOMER_JWT_REFRESH_SECRET","label":"用户端 Refresh Token 密钥","required":true,"secret":true,"resourceKind":null},{"key":"PUBLIC_API_BASE_URL","label":"公共 API 地址","required":true,"secret":false,"resourceKind":null}]'::jsonb,
  true,
  1
);

ALTER TABLE "DeployEnvironment" ADD COLUMN "projectId" TEXT;
ALTER TABLE "DeployEnvironment" ADD COLUMN "environmentValues" JSONB NOT NULL DEFAULT '{}';
UPDATE "DeployEnvironment" SET "projectId" = 'system-aiforge-fullstack' WHERE "projectId" IS NULL;
ALTER TABLE "DeployEnvironment" ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "DeployRun" ADD COLUMN "executionSnapshot" JSONB;

DROP INDEX IF EXISTS "DeployEnvironment_kind_updatedAt_idx";
CREATE INDEX "DeployEnvironment_projectId_kind_updatedAt_idx"
  ON "DeployEnvironment"("projectId", "kind", "updatedAt");
ALTER TABLE "DeployEnvironment"
  ADD CONSTRAINT "DeployEnvironment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "DeployProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
