import { describe, expect, it } from 'vitest';
import type { IntegrationKind, UpsertServiceResourceRequest } from '@template/contracts';
import {
  decryptDeploymentSecrets,
  encryptDeploymentSecrets,
} from '../deployments/deployment-secrets.js';
import { IntegrationsService } from './integrations.service.js';

const sqlValues = {
  engine: 'postgresql',
  host: 'localhost',
  port: '5432',
  database: 'demo',
  username: 'demo',
};
const auditEvents: Array<Record<string, unknown>> = [];
const createService = (): IntegrationsService => {
  const rows = new Map<string, Record<string, unknown>>();
  const integrationConfig = {
    findUnique: ({ where }: { where: { kind: string } }) => Promise.resolve(rows.get(where.kind)),
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { kind: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const previous = rows.get(where.kind);
      const row = {
        ...(previous ?? create),
        ...(previous ? update : {}),
        kind: where.kind,
        updatedAt: new Date(),
      };
      rows.set(where.kind, row);
      return Promise.resolve(row);
    },
  };
  return new IntegrationsService(
    {
      integrationConfig,
      serviceResource: { findFirst: () => Promise.resolve(null) },
    } as never,
    {
      record: (event: Record<string, unknown>) => {
        auditEvents.push(event);
        return Promise.resolve();
      },
    } as never,
  );
};
describe('IntegrationsService', () => {
  it('never returns secret values after configuration', async () => {
    const service = createService();
    const saved = await service.update('sql', {
      enabled: true,
      values: sqlValues,
      secrets: { password: 'top-secret' },
    });
    expect(saved.configuredSecrets).toContain('password');
    expect(saved.values).not.toHaveProperty('password');
    expect(JSON.stringify(saved)).not.toContain('top-secret');
  });

  it('synchronizes updated Git resources to bound deployment environments', async () => {
    const environmentUpdates: Array<Record<string, unknown>> = [];
    const updatedAt = new Date();
    const resource = {
      id: 'git-1',
      name: 'Git',
      kind: 'git',
      provider: 'git',
      enabled: true,
      values: {
        repositoryUrl: 'https://example.com/old.git',
        defaultRef: 'main',
        authMode: 'token',
      },
      encryptedSecrets: null,
      createdAt: updatedAt,
      updatedAt,
    };
    const prisma = {
      serviceResource: {
        findUnique: () => Promise.resolve(resource),
        findMany: () => Promise.resolve([resource]),
      },
      $transaction: async (work: (transaction: object) => Promise<void>) =>
        work({
          serviceResource: {
            update: ({ data }: { data: Record<string, unknown> }) => {
              Object.assign(resource, data, { updatedAt });
              return Promise.resolve(resource);
            },
          },
          deployEnvironment: {
            findMany: () =>
              Promise.resolve([
                {
                  id: 'environment-1',
                  encryptedSecrets: encryptDeploymentSecrets({ sshPassword: 'server-secret' }),
                },
              ]),
            update: ({ data }: { data: Record<string, unknown> }) => {
              environmentUpdates.push(data);
              return Promise.resolve(data);
            },
          },
        }),
    };
    const service = new IntegrationsService(
      prisma as never,
      { record: () => Promise.resolve() } as never,
    );

    await service.updateResource('git-1', {
      name: 'Git',
      kind: 'git',
      provider: 'git',
      enabled: true,
      values: {
        repositoryUrl: 'https://example.com/new.git',
        defaultRef: 'release',
        authMode: 'token',
      },
      secrets: { token: 'new-token' },
    });

    expect(environmentUpdates[0]).toMatchObject({
      repositoryUrl: 'https://example.com/new.git',
      gitRef: 'release',
      gitAuthMode: 'token',
      status: 'DRAFT',
      gitVerifiedAt: null,
      lastVerifiedAt: null,
    });
    expect(decryptDeploymentSecrets(environmentUpdates[0]?.encryptedSecrets as string)).toEqual({
      sshPassword: 'server-secret',
      gitToken: 'new-token',
    });
  });

  it.each([
    {
      kind: 'server',
      values: {
        host: 'server.example.com',
        port: '2222',
        username: 'deploy',
        authMode: 'password',
        deployRoot: '/srv/default',
      },
      secrets: { password: 'ssh-secret' },
      binding: 'serverResourceId',
      expectedData: {
        host: 'server.example.com',
        sshPort: 2222,
        sshUser: 'deploy',
        sshAuthMode: 'password',
        serverVerifiedAt: null,
      },
      expectedSecrets: { sshPassword: 'ssh-secret' },
    },
    {
      kind: 'sql',
      values: sqlValues,
      secrets: { password: 'database-secret' },
      binding: 'sqlResourceId',
      expectedData: { gitVerifiedAt: null, serverVerifiedAt: null },
      expectedSecrets: {
        databaseUrl: 'postgresql://demo:database-secret@localhost:5432/demo?schema=public',
      },
    },
    {
      kind: 'redis',
      values: { provider: 'self_hosted', url: 'redis://cache.example.com:6379/0' },
      secrets: { password: 'redis-secret' },
      binding: 'redisResourceId',
      expectedData: { gitVerifiedAt: null, serverVerifiedAt: null },
      expectedSecrets: { redisUrl: 'redis://:redis-secret@cache.example.com:6379/0' },
    },
  ] as const)(
    'synchronizes updated $kind resources to bound deployment environments',
    async ({ kind, values, secrets, binding, expectedData, expectedSecrets }) => {
      const environmentUpdates: Array<Record<string, unknown>> = [];
      const now = new Date();
      const resource = {
        id: `${kind}-1`,
        name: kind,
        kind,
        provider: kind,
        enabled: true,
        values,
        encryptedSecrets: null,
        createdAt: now,
        updatedAt: now,
      };
      const deployEnvironment = {
        findMany: ({ where }: { where: Record<string, string> }) => {
          expect(where).toEqual({ [binding]: resource.id });
          return Promise.resolve([
            { id: 'environment-1', encryptedSecrets: encryptDeploymentSecrets({}) },
          ]);
        },
        update: ({ data }: { data: Record<string, unknown> }) => {
          environmentUpdates.push(data);
          return Promise.resolve(data);
        },
      };
      const prisma = {
        serviceResource: {
          findUnique: () => Promise.resolve(resource),
          findMany: () => Promise.resolve([resource]),
        },
        $transaction: async (work: (transaction: object) => Promise<void>) =>
          work({
            serviceResource: { update: () => Promise.resolve(resource) },
            deployEnvironment,
          }),
      };
      const service = new IntegrationsService(
        prisma as never,
        { record: () => Promise.resolve() } as never,
      );

      await service.updateResource(resource.id, {
        name: kind,
        kind,
        provider: kind,
        enabled: true,
        values,
        secrets,
      } as UpsertServiceResourceRequest);

      expect(environmentUpdates[0]).toMatchObject({
        ...expectedData,
        status: 'DRAFT',
        lastVerifiedAt: null,
      });
      expect(decryptDeploymentSecrets(environmentUpdates[0]?.encryptedSecrets as string)).toEqual(
        expectedSecrets,
      );
    },
  );
  it('lists the fixed service resource types independently of project modules', async () => {
    const service = createService();
    const items = await service.list();
    const expected: IntegrationKind[] = [
      'object_storage',
      'sql',
      'redis',
      'sms',
      'email',
      'payment',
      'server',
      'git',
    ];
    expect(items.map((item) => item.kind)).toEqual(expected);
  });
  it('rejects unknown fields and invalid platform options', async () => {
    const service = createService();
    await expect(
      service.update('sql', { enabled: false, values: { unknown: 'value' }, secrets: {} }),
    ).rejects.toMatchObject({ message: 'INTEGRATION_FIELD_INVALID' });
    await expect(
      service.update('sql', { enabled: false, values: { engine: 'oracle' }, secrets: {} }),
    ).rejects.toMatchObject({ message: 'INTEGRATION_OPTION_INVALID' });
  });
  it('requires complete configuration when enabling a service', async () => {
    const service = createService();
    await expect(
      service.update('sql', { enabled: true, values: { engine: 'postgresql' }, secrets: {} }),
    ).rejects.toMatchObject({ message: 'INTEGRATION_REQUIRED_FIELD_MISSING' });
  });
  it('audits field names without secret values', async () => {
    auditEvents.length = 0;
    await createService().update(
      'sql',
      { enabled: true, values: sqlValues, secrets: { password: 'never-log-this' } },
      { actorId: 'admin-1' },
    );
    expect(auditEvents[0]).toMatchObject({
      actorId: 'admin-1',
      action: 'integration.update',
      result: 'success',
      metadata: { secretFieldsChanged: ['password'] },
    });
    expect(JSON.stringify(auditEvents)).not.toContain('never-log-this');
  });
});
