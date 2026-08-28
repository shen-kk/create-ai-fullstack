import type { UpsertDeploymentEnvironmentRequest } from '@template/contracts';

type DeploymentSecrets = UpsertDeploymentEnvironmentRequest['secrets'];
type DedicatedSecretKey = Exclude<keyof DeploymentSecrets, 'variables'>;

const dedicatedSecretKeys: Readonly<Record<string, DedicatedSecretKey>> = {
  DATABASE_URL: 'databaseUrl',
  REDIS_URL: 'redisUrl',
  JWT_ACCESS_SECRET: 'jwtAccessSecret',
  JWT_REFRESH_SECRET: 'jwtRefreshSecret',
  CONFIG_ENCRYPTION_KEY: 'configEncryptionKey',
  CUSTOMER_JWT_ACCESS_SECRET: 'customerJwtAccessSecret',
  CUSTOMER_JWT_REFRESH_SECRET: 'customerJwtRefreshSecret',
};

export function deploymentVariableSecretValue(
  variableKey: string,
  secrets: DeploymentSecrets,
): string {
  const variableValue = secrets.variables?.[variableKey];
  if (variableValue !== undefined) return variableValue;

  const dedicatedKey = dedicatedSecretKeys[variableKey];
  return dedicatedKey ? (secrets[dedicatedKey] ?? '') : '';
}

export function deploymentProjectPath(projectId?: string): string {
  return projectId ? `/deployments/projects/${encodeURIComponent(projectId)}` : '/deployments';
}
