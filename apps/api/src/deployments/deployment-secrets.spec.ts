import { afterEach, describe, expect, it } from 'vitest';
import { decryptDeploymentSecrets, encryptDeploymentSecrets } from './deployment-secrets.js';

describe('deployment secrets', () => {
  const previous = process.env.CONFIG_ENCRYPTION_KEY;
  afterEach(() => {
    if (previous === undefined) delete process.env.CONFIG_ENCRYPTION_KEY;
    else process.env.CONFIG_ENCRYPTION_KEY = previous;
  });

  it('encrypts credentials without retaining plaintext', () => {
    process.env.CONFIG_ENCRYPTION_KEY = 'test-only-encryption-key-that-is-long-enough';
    const encrypted = encryptDeploymentSecrets({
      gitToken: 'secret-token',
      sshPassword: 'secret-password',
    });
    expect(encrypted).not.toContain('secret-token');
    expect(encrypted).not.toContain('secret-password');
    expect(decryptDeploymentSecrets(encrypted)).toEqual({
      gitToken: 'secret-token',
      sshPassword: 'secret-password',
    });
  });

  it('rejects ciphertext encrypted with another key', () => {
    process.env.CONFIG_ENCRYPTION_KEY = 'first-test-key-that-is-long-enough';
    const encrypted = encryptDeploymentSecrets({ gitToken: 'secret-token' });
    process.env.CONFIG_ENCRYPTION_KEY = 'second-test-key-that-is-long-enough';
    expect(() => decryptDeploymentSecrets(encrypted)).toThrow(
      'DEPLOYMENT_SECRETS_REENTRY_REQUIRED',
    );
  });
});
