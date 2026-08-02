CREATE TYPE "PermissionType" AS ENUM ('MENU', 'ACTION');

ALTER TABLE "Permission"
ADD COLUMN "type" "PermissionType" NOT NULL DEFAULT 'ACTION',
ADD COLUMN "groupCode" TEXT NOT NULL DEFAULT 'system';

UPDATE "Permission" SET "groupCode" = CASE
  WHEN "code" LIKE 'users.%' THEN 'users'
  WHEN "code" LIKE 'roles.%' THEN 'roles'
  WHEN "code" LIKE 'audit.%' THEN 'audit'
  ELSE 'system'
END;

CREATE INDEX "Permission_type_groupCode_idx" ON "Permission"("type", "groupCode");
