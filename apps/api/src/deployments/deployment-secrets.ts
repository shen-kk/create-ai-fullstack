import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface DeploymentSecrets {
  gitToken?: string;
  gitSshPrivateKey?: string;
  sshPassword?: string;
  sshPrivateKey?: string;
  databaseUrl?: string;
  redisUrl?: string;
  jwtAccessSecret?: string;
  jwtRefreshSecret?: string;
  configEncryptionKey?: string;
  customerJwtAccessSecret?: string;
  customerJwtRefreshSecret?: string;
  variables?: Record<string, string>;
}

const key = (): Buffer =>
  createHash('sha256')
    .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
    .digest();

export function encryptDeploymentSecrets(value: DeploymentSecrets): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decryptDeploymentSecrets(value: string | null): DeploymentSecrets {
  if (!value) return {};
  try {
    const payload = Buffer.from(value, 'base64');
    if (payload.length <= 28) throw new Error('invalid deployment secret payload');
    const decipher = createDecipheriv('aes-256-gcm', key(), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'),
    ) as DeploymentSecrets;
  } catch {
    throw new Error('DEPLOYMENT_SECRETS_REENTRY_REQUIRED');
  }
}

export function safeDecryptDeploymentSecrets(value: string | null): DeploymentSecrets {
  try {
    return decryptDeploymentSecrets(value);
  } catch {
    return {};
  }
}
