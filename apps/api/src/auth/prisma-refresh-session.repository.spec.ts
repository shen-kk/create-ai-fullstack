import { describe, expect, it, vi } from 'vitest';
import { PrismaRefreshSessionRepository } from './prisma-refresh-session.repository.js';

describe('PrismaRefreshSessionRepository device sessions', () => {
  it('creates and maps the current administrator session', async () => {
    const createdAt = new Date('2026-08-29T00:00:00.000Z');
    const expiresAt = new Date('2026-08-30T00:00:00.000Z');
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
    const repository = new PrismaRefreshSessionRepository({ refreshSession: delegate } as never);

    await expect(
      repository.create('user-1', 'hash', expiresAt, {
        userAgent: 'Browser',
        ipAddress: '127.0.0.1',
      }),
    ).resolves.toBe('session-1');
    await expect(repository.list('user-1', 'session-1')).resolves.toEqual([
      {
        id: 'session-1',
        userAgent: 'Browser',
        ipAddress: '127.0.0.1',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        current: true,
      },
    ]);
  });

  it('checks activity and revokes every session except the current one atomically', async () => {
    const delegate = {
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    };
    const repository = new PrismaRefreshSessionRepository({ refreshSession: delegate } as never);

    await expect(repository.isActive('user-1', 'session-1')).resolves.toBe(true);
    await expect(repository.revokeOthers('user-1', 'session-1')).resolves.toBe(2);
    expect(delegate.updateMany).toHaveBeenCalledOnce();
  });
});
