import { describe, expect, it } from 'vitest';
import { deploymentSecretValues, redactDeploymentLog } from './deployment-log-redaction.js';

describe('deployment log redaction', () => {
  it('redacts actual secret values even when output does not include a field name', () => {
    const values = deploymentSecretValues({
      databaseUrl: 'postgresql://admin:secret@database/app',
      variables: { THIRD_PARTY_SECRET: 'opaque-value' },
    });
    const output = redactDeploymentLog(
      'connecting to postgresql://admin:secret@database/app with opaque-value',
      values,
    );
    expect(output).toBe('connecting to *** with ***');
  });

  it('keeps the field-name fallback for unknown credential-shaped output', () => {
    expect(redactDeploymentLog('password=unexpected token=unexpected', [])).toBe(
      'password=*** token=***',
    );
  });
});
