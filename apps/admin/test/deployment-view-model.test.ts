import { describe, expect, it } from 'vitest';
import {
  deploymentProjectPath,
  deploymentVariableSecretValue,
} from '../src/deployments/view-model.js';

describe('deployment view model', () => {
  it('reads generated project variables from their dedicated secret fields', () => {
    expect(
      deploymentVariableSecretValue('JWT_ACCESS_SECRET', {
        jwtAccessSecret: 'revealed-access-secret',
      }),
    ).toBe('revealed-access-secret');
  });

  it('prefers an explicitly stored project variable', () => {
    expect(
      deploymentVariableSecretValue('DATABASE_URL', {
        databaseUrl: 'dedicated-value',
        variables: { DATABASE_URL: 'variable-value' },
      }),
    ).toBe('variable-value');
  });

  it('returns to the environment list for the run project', () => {
    expect(deploymentProjectPath('project/with spaces')).toBe(
      '/deployments/projects/project%2Fwith%20spaces',
    );
    expect(deploymentProjectPath()).toBe('/deployments');
  });
});
