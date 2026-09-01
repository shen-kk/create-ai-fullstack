import { describe, expect, it } from 'vitest';
import { deploymentErrorCode, deploymentErrorMessage } from './deployment-error.js';

describe('deploymentErrorCode', () => {
  it('classifies failures by the active deployment step', () => {
    expect(deploymentErrorCode('migrate', new Error('exit 1'))).toBe('DEPLOYMENT_MIGRATION_FAILED');
    expect(deploymentErrorCode('health', new Error('HTTP 503'))).toBe(
      'DEPLOYMENT_HEALTH_CHECK_FAILED',
    );
  });

  it('preserves stable timeout and snapshot errors', () => {
    expect(deploymentErrorCode('build', new Error('DEPLOYMENT_COMMAND_TIMEOUT'))).toBe(
      'DEPLOYMENT_COMMAND_TIMEOUT',
    );
    expect(deploymentErrorCode(null, new Error('DEPLOYMENT_SNAPSHOT_VERSION_UNSUPPORTED'))).toBe(
      'DEPLOYMENT_SNAPSHOT_VERSION_UNSUPPORTED',
    );
  });

  it('classifies secret decryption failures before the active step fallback', () => {
    const error = new Error('DEPLOYMENT_SECRETS_REENTRY_REQUIRED');
    expect(deploymentErrorCode('prepare', error)).toBe('DEPLOYMENT_SECRETS_REENTRY_REQUIRED');
    expect(deploymentErrorMessage(error)).toContain('CONFIG_ENCRYPTION_KEY');
  });
});
