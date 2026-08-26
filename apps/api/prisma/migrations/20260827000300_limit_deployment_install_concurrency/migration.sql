ALTER TABLE "DeployProject"
  ALTER COLUMN "installCommand" SET DEFAULT 'pnpm install --frozen-lockfile --child-concurrency=1';

UPDATE "DeployProject"
SET "installCommand" = replace(
  "installCommand",
  'pnpm install --frozen-lockfile',
  'pnpm install --frozen-lockfile --child-concurrency=1'
)
WHERE "installCommand" = 'pnpm install --frozen-lockfile';
