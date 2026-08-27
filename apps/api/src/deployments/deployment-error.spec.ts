import { describe, expect, it } from 'vitest';
import { deploymentErrorCode } from './deployment-error.js';

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
});
