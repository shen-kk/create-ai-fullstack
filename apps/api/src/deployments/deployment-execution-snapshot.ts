import type { DeploymentExecutionSnapshot, DeploymentExecutionUnit } from '@template/contracts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

function isExecutionUnit(value: unknown): value is DeploymentExecutionUnit {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    typeof value.buildCommand === 'string' &&
    isNullableString(value.migrationCommand) &&
    typeof value.restartCommand === 'string' &&
    isNullableString(value.healthCheckUrl)
  );
}

export function parseDeploymentExecutionSnapshot(value: unknown): DeploymentExecutionSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 2)
    throw new Error('DEPLOYMENT_SNAPSHOT_VERSION_UNSUPPORTED');
  const project = value.project;
  const environment = value.environment;
  if (!isRecord(project) || !isRecord(environment)) throw new Error('DEPLOYMENT_SNAPSHOT_INVALID');
  if (
    typeof project.id !== 'string' ||
    typeof project.code !== 'string' ||
    typeof project.version !== 'number' ||
    project.type !== 'release-directory' ||
    typeof project.installCommand !== 'string' ||
    !Array.isArray(project.units) ||
    !project.units.every(isExecutionUnit) ||
    !Array.isArray(project.variables) ||
    !project.variables.every(
      (variable) =>
        isRecord(variable) &&
        typeof variable.key === 'string' &&
        typeof variable.required === 'boolean' &&
        typeof variable.secret === 'boolean',
    ) ||
    typeof environment.id !== 'string' ||
    !isRecord(environment.values) ||
    !Object.values(environment.values).every((item) => typeof item === 'string') ||
    !isRecord(environment.resourceBindings) ||
    !isNullableString(environment.resourceBindings.sql) ||
    !isNullableString(environment.resourceBindings.redis) ||
    !Array.isArray(value.applications) ||
    !value.applications.every((item) => typeof item === 'string') ||
    typeof value.createdAt !== 'string'
  )
    throw new Error('DEPLOYMENT_SNAPSHOT_INVALID');
  return value as unknown as DeploymentExecutionSnapshot;
}
