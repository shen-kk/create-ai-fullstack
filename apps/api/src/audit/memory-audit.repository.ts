import { Injectable } from '@nestjs/common';
import type { AuditLogListResponse, AuditLogSummary } from '@template/contracts';
import { randomUUID } from 'node:crypto';
import type { AuditEvent, AuditRepository } from './audit.repository.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

@Injectable()
export class MemoryAuditRepository implements AuditRepository {
  private readonly logs: AuditLogSummary[] = [];
  record(event: AuditEvent): Promise<void> {
    this.logs.unshift({
      id: randomUUID(),
      actorId: event.actorId ?? null,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId ?? null,
      result: event.result,
      requestId: event.requestId ?? null,
      ipAddress: event.ipAddress ?? null,
      createdAt: new Date().toISOString(),
    });
    return Promise.resolve();
  }
  list(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    const keyword = query.keyword?.trim().toLowerCase();
    const filtered = this.logs.filter(
      (log) =>
        (!query.action || log.action === query.action) &&
        (!query.resource || log.resource === query.resource) &&
        (!query.result || log.result === query.result) &&
        (!keyword ||
          [log.actorId, log.resourceId, log.requestId, log.ipAddress].some((value) =>
            value?.toLowerCase().includes(keyword),
          )),
    );
    const start = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: filtered.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    });
  }
}
