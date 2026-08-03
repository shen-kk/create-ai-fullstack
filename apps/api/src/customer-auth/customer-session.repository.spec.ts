import { describe, expect, it } from 'vitest';
import { CustomerSessionRepository } from './customer-session.repository.js';
describe('CustomerSessionRepository', () => {
  it('lists devices and revokes other sessions without revoking current', async () => {
    const repository = new CustomerSessionRepository({} as never);
    const currentId = await repository.create(
      'customer-1',
      'current',
      new Date(Date.now() + 60000),
      {
        ipAddress: '127.0.0.1',
        userAgent: 'Current',
      },
    );
    await repository.create('customer-1', 'other', new Date(Date.now() + 60000), {
      ipAddress: '10.0.0.2',
      userAgent: 'Other',
    });
    expect(await repository.list('customer-1', currentId)).toHaveLength(2);
    expect(await repository.isActive('customer-1', currentId)).toBe(true);
    expect(await repository.revokeOthers('customer-1', currentId)).toBe(1);
    const remaining = await repository.list('customer-1', currentId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.current).toBe(true);
  });

  it('reports revoked and expired sessions as inactive', async () => {
    const repository = new CustomerSessionRepository({} as never);
    const revokedId = await repository.create(
      'customer-1',
      'revoked',
      new Date(Date.now() + 60000),
      {},
    );
    const expiredId = await repository.create(
      'customer-1',
      'expired',
      new Date(Date.now() - 1000),
      {},
    );
    await repository.revokeById('customer-1', revokedId);
    expect(await repository.isActive('customer-1', revokedId)).toBe(false);
    expect(await repository.isActive('customer-1', expiredId)).toBe(false);
    expect(await repository.isActive('another-customer', expiredId)).toBe(false);
  });
});
