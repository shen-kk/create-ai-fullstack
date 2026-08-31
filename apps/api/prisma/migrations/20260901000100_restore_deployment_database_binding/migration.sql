UPDATE "DeployProject"
SET
  "variables" = "variables" || '[{"key":"DATABASE_URL","label":"数据库连接","required":true,"secret":true,"resourceKind":"sql"}]'::jsonb,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "system" = true
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements("variables") AS variable
    WHERE variable->>'key' = 'DATABASE_URL'
  );

UPDATE "DeployEnvironment" AS environment
SET
  "status" = 'DRAFT',
  "lastVerifiedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "DeployProject" AS project
WHERE
  environment."projectId" = project."id"
  AND environment."sqlResourceId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(project."variables") AS variable
    WHERE variable->>'resourceKind' = 'sql' AND (variable->>'required')::boolean = true
  );
