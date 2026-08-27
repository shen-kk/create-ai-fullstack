import { describe, expect, it } from 'vitest';
import { parseDeploymentExecutionSnapshot } from './deployment-execution-snapshot.js';

const snapshot = {
  schemaVersion: 2,
  project: {
    id: 'project-1',
    code: 'project',
    version: 1,
    type: 'release-directory',
    installCommand: 'pnpm install --frozen-lockfile',
    units: [
      {
        key: 'api',
        buildCommand: 'pnpm build',
        migrationCommand: null,
        restartCommand: 'pm2 reload api',
        healthCheckUrl: null,
      },
    ],
    variables: [{ key: 'DATABASE_URL', required: true, secret: true }],
  },
  environment: {
    id: 'environment-1',
    values: {},
    resourceBindings: { sql: 'sql-1', redis: null },
  },
  applications: ['api'],
  createdAt: new Date().toISOString(),
};

describe('parseDeploymentExecutionSnapshot', () => {
  it('accepts the current immutable snapshot contract', () => {
    expect(parseDeploymentExecutionSnapshot(snapshot)).toMatchObject({ schemaVersion: 2 });
  });

  it('rejects unknown versions and damaged commands', () => {
    expect(() => parseDeploymentExecutionSnapshot({ ...snapshot, schemaVersion: 3 })).toThrow(
      'DEPLOYMENT_SNAPSHOT_VERSION_UNSUPPORTED',
    );
    expect(() =>
      parseDeploymentExecutionSnapshot({
        ...snapshot,
        project: { ...snapshot.project, units: [{ key: 'api' }] },
      }),
    ).toThrow('DEPLOYMENT_SNAPSHOT_INVALID');
  });
});
