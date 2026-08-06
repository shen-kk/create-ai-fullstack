import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type DeploymentSecrets = Partial<
  Record<'sshPrivateKey' | 'sshPassword' | 'cnbToken' | 'registryToken', string>
>;

const key = (): Buffer =>
  createHash('sha256')
    .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
    .digest();

export function encryptDeploymentSecrets(secrets: DeploymentSecrets): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decryptDeploymentSecrets(value: string | null | undefined): DeploymentSecrets {
  if (!value) return {};
  const payload = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'),
  ) as DeploymentSecrets;
}
