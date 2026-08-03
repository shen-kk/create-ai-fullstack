INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode") VALUES
  ('perm_menu_customers', 'menu.customers', '显示用户端用户菜单', 'MENU', 'customers'),
  ('perm_customers_read', 'customers.read', '查看用户端用户', 'ACTION', 'customers'),
  ('perm_customers_write', 'customers.write', '修改用户端用户状态', 'ACTION', 'customers')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."code" = 'super_admin'
  AND permission."code" IN ('menu.customers', 'customers.read', 'customers.write')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
