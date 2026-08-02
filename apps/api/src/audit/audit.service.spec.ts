import { describe, expect, it } from 'vitest';
import { AuditService } from './audit.service.js';
import { MemoryAuditRepository } from './memory-audit.repository.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

describe('AuditService', () => {
  it('records and lists immutable audit summaries', async () => {
    const service = new AuditService(new MemoryAuditRepository());
    await service.record({
      actorId: 'admin',
      action: 'user.update',
      resource: 'user',
      resourceId: 'user-1',
      result: 'success',
      requestId: 'request-1',
    });
    const result = await service.list(
      Object.assign(new ListAuditLogsQueryDto(), { page: 1, pageSize: 20 }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      actorId: 'admin',
      action: 'user.update',
      resourceId: 'user-1',
      requestId: 'request-1',
    });
  });
  it('filters by action and request metadata keyword', async () => {
    const service = new AuditService(new MemoryAuditRepository());
    await service.record({
      actorId: 'admin-1',
      action: 'role.update',
      resource: 'role',
      resourceId: 'operator',
      result: 'success',
      requestId: 'request-special',
    });
    await service.record({ action: 'user.create', resource: 'user', result: 'failure' });
    const result = await service.list(
      Object.assign(new ListAuditLogsQueryDto(), { action: 'role.update', keyword: 'special' }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]?.resourceId).toBe('operator');
  });
});
