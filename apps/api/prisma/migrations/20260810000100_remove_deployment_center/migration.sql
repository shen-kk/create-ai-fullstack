DELETE FROM "RolePermission"
WHERE "permissionId" IN (
  SELECT "id"
  FROM "Permission"
  WHERE "code" IN (
    'menu.deployments',
    'deployments.read',
    'deployments.manage',
    'deployments.execute'
  )
);

DELETE FROM "Permission"
WHERE "code" IN (
  'menu.deployments',
  'deployments.read',
  'deployments.manage',
  'deployments.execute'
);

DROP TABLE IF EXISTS "DeploymentRun";
DROP TABLE IF EXISTS "DeployAgent";
DROP TABLE IF EXISTS "DeploymentTarget";
DROP TYPE IF EXISTS "DeploymentRunStatus";
DROP TYPE IF EXISTS "DeploymentTargetStatus";
DROP TYPE IF EXISTS "DeploymentEnvironment";
