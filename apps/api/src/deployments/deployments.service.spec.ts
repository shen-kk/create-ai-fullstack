import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { DeploymentConnectionService } from './deployment-connection.service.js';
import { DeploymentsService } from './deployments.service.js';

describe('DeploymentsService', () => {
  const originalDataSource = process.env.DATA_SOURCE;
  const connection = {
    test: vi.fn().mockResolvedValue({
      success: true,
      checkedAt: '2026-08-06T08:00:00.000Z',
      checks: [{ key: 'ssh', label: 'SSH', status: 'passed', message: '连接成功' }],
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new DeploymentsService(
    {} as unknown as PrismaService,
    connection as unknown as DeploymentConnectionService,
    audit as unknown as AuditService,
  );
  const context = { actorId: 'adm_dev' };

  beforeEach(() => {
    process.env.DATA_SOURCE = 'memory';
    vi.restoreAllMocks();
    connection.test.mockResolvedValue({
      success: true,
      checkedAt: '2026-08-06T08:00:00.000Z',
      checks: [{ key: 'ssh', label: 'SSH', status: 'passed', message: '连接成功' }],
    });
  });
  afterEach(() => {
    if (originalDataSource === undefined) delete process.env.DATA_SOURCE;
    else process.env.DATA_SOURCE = originalDataSource;
  });

  it('stores deployment credentials without returning their values', async () => {
    const target = await service.createTarget(
      {
        name: `测试环境-${crypto.randomUUID()}`,
        environment: 'test',
        applications: ['admin', 'api'],
        host: '192.0.2.10',
        sshPort: 22,
        sshUser: 'deploy',
        deployPath: '/opt/apps/demo',
        accessMode: 'ip_port',
        adminUrl: 'http://192.0.2.10:3000',
        apiUrl: 'http://192.0.2.10:3001',
        cnbRepository: 'demo/project',
        secrets: { sshPassword: 'secret-password', cnbToken: 'secret-token' },
      },
      context,
    );

    expect(target.configuredSecrets).toEqual(['sshPassword', 'cnbToken']);
    expect(JSON.stringify(target)).not.toContain('secret-password');
    expect(target.status).toBe('draft');
  });

  it('requires a verified target and starts a real CNB build request', async () => {
    const target = await service.createTarget(
      {
        name: `预发布-${crypto.randomUUID()}`,
        environment: 'staging',
        applications: ['admin', 'api'],
        host: 'deploy.example.com',
        sshPort: 22,
        sshUser: 'deploy',
        deployPath: '/opt/apps/demo',
        accessMode: 'ip_port',
        adminUrl: 'http://deploy.example.com:3000',
        apiUrl: 'http://deploy.example.com:3001',
        cnbRepository: 'demo/project',
        secrets: { sshPrivateKey: 'private-key', cnbToken: 'cnb-token' },
      },
      context,
    );
    await service.testConnection(target.id, context);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'build-1' }), { status: 200 }));

    const run = await service.startRun(
      target.id,
      { version: 'main', applications: ['admin', 'api'] },
      context,
    );

    expect(run.status).toBe('building');
    expect(run.cnbBuildId).toBe('build-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cnb.cool/demo/project/-/build/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
