import { describe, expect, it, vi } from 'vitest';
import { CustomerSessionRepository } from './customer-session.repository.js';

describe('CustomerSessionRepository', () => {
  it('creates and maps persisted sessions', async () => {
    const createdAt = new Date('2026-08-10T00:00:00.000Z');
    const expiresAt = new Date('2026-08-10T01:00:00.000Z');
    const delegate = {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'Browser',
          ipAddress: '127.0.0.1',
          createdAt,
          expiresAt,
        },
      ]),
    };
    const repository = new CustomerSessionRepository({ customerRefreshSession: delegate } as never);
    const id = await repository.create('customer-1', 'hash', expiresAt, {
      ipAddress: '127.0.0.1',
      userAgent: 'Browser',
    });
    expect(id).toBe('session-1');
    await expect(repository.list('customer-1', id)).resolves.toEqual([
      {
        id,
        userAgent: 'Browser',
        ipAddress: '127.0.0.1',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        current: true,
      },
    ]);
  });

  it('uses atomic database updates for revocation and activity checks', async () => {
    const delegate = {
      count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    };
    const repository = new CustomerSessionRepository({ customerRefreshSession: delegate } as never);
    await expect(repository.isActive('customer-1', 'session-1')).resolves.toBe(true);
    await expect(repository.isActive('customer-1', 'session-2')).resolves.toBe(false);
    await expect(repository.revokeOthers('customer-1', 'session-1')).resolves.toBe(2);
    expect(delegate.updateMany).toHaveBeenCalledOnce();
  });
});
