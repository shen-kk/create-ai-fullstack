import { describe, expect, it } from 'vitest';
import type { IntegrationKind } from '@template/contracts';
import { project } from '../generated/project.js';
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
    { integrationConfig } as never,
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
  it('lists the infrastructure integrations enabled by the project declaration', async () => {
    const service = createService();
    const items = await service.list();
    const expected: IntegrationKind[] = [
      ...(project.modules.objectStorage ? (['object_storage'] as const) : []),
      'sql',
      ...(project.modules.redis ? (['redis'] as const) : []),
      ...(project.modules.sms ? (['sms'] as const) : []),
      ...(project.modules.email ? (['email'] as const) : []),
      ...(project.modules.payment ? (['payment'] as const) : []),
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
