INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode", "createdAt")
VALUES
  ('perm_menu_system', 'menu.system', '显示系统信息菜单', 'MENU', 'system', CURRENT_TIMESTAMP),
  ('perm_system_read', 'system.read', '查看系统运行信息', 'ACTION', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description", "type" = EXCLUDED."type", "groupCode" = EXCLUDED."groupCode";

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'super_admin' AND p."code" IN ('menu.system', 'system.read')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
