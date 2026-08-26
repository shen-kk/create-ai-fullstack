ALTER TABLE "DeployProject"
  ALTER COLUMN "installCommand" SET DEFAULT 'pnpm install --frozen-lockfile';

UPDATE "DeployProject"
SET
  "installCommand" = replace("installCommand", 'corepack pnpm', 'pnpm'),
  "units" = replace("units"::text, 'corepack pnpm', 'pnpm')::jsonb
WHERE
  "installCommand" LIKE '%corepack pnpm%'
  OR "units"::text LIKE '%corepack pnpm%';
