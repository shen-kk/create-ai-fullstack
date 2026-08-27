import type { DeploymentSecrets } from './deployment-secrets.js';

export function deploymentSecretValues(secrets: DeploymentSecrets): string[] {
  return [
    secrets.gitToken,
    secrets.gitSshPrivateKey,
    secrets.sshPassword,
    secrets.sshPrivateKey,
    secrets.databaseUrl,
    secrets.redisUrl,
    secrets.jwtAccessSecret,
    secrets.jwtRefreshSecret,
    secrets.configEncryptionKey,
    secrets.customerJwtAccessSecret,
    secrets.customerJwtRefreshSecret,
    ...Object.values(secrets.variables ?? {}),
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length);
}

export function redactDeploymentLog(raw: string, secretValues: string[]): string {
  let message = raw;
  for (const secret of secretValues) message = message.replaceAll(secret, '***');
  return message.replace(/(token|password|private.?key)=?[^\s]*/gi, '$1=***');
}
