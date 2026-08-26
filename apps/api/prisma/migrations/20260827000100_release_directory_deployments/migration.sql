UPDATE "DeployEnvironment" SET "currentReleaseId" = NULL;
DELETE FROM "DeployLog";
DELETE FROM "DeployStep";
DELETE FROM "DeployRun";
DELETE FROM "DeployRelease";
DELETE FROM "DeployEnvironment";
DELETE FROM "DeployProject";

ALTER TABLE "DeployProject" RENAME COLUMN "composeFile" TO "installCommand";
ALTER TABLE "DeployProject" ALTER COLUMN "type" SET DEFAULT 'release-directory';
ALTER TABLE "DeployProject"
  ALTER COLUMN "installCommand" SET DEFAULT 'corepack pnpm install --frozen-lockfile';
