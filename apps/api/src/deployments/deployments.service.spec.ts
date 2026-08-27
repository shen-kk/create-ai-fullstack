import { describe, expect, it } from 'vitest';
import { DeploymentsService } from './deployments.service.js';

const createService = (prisma: object): DeploymentsService =>
  new DeploymentsService(prisma as never, {} as never, {} as never);

describe('DeploymentsService worker availability', () => {
  it('reports online workers and queue depth', async () => {
    const heartbeat = new Date();
    const service = createService({
      deployWorker: { findMany: () => Promise.resolve([{ lastHeartbeatAt: heartbeat }]) },
      deployRun: {
        count: (() => {
          let call = 0;
          return () => Promise.resolve(call++ === 0 ? 2 : 1);
        })(),
      },
      $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
    });

    await expect(service.getWorkerStatus()).resolves.toEqual({
      online: true,
      activeWorkers: 1,
      queuedRuns: 2,
      runningRuns: 1,
      lastHeartbeatAt: heartbeat.toISOString(),
    });
  });

  it('rejects new deployment tasks when no worker is online', async () => {
    const service = createService({
      deployWorker: { findFirst: () => Promise.resolve(null) },
    });

    await expect(service.createRun('environment-1', {}, { actorId: 'admin-1' })).rejects.toThrow(
      'DEPLOYMENT_WORKER_OFFLINE',
    );
  });
});
