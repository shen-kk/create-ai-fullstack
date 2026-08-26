INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode", "createdAt")
VALUES ('perm_secrets_read', 'secrets.read', '查看服务与部署敏感配置明文', 'ACTION', 'security', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "groupCode" = EXCLUDED."groupCode";

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."code" = 'super_admin' AND permission."code" = 'secrets.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
