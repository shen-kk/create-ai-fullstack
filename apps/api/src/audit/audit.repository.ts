import type { AuditLogListResponse } from '@template/contracts';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

export const auditRepositoryToken = Symbol('AuditRepository');
export interface AuditEvent {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  result: 'success' | 'failure';
  requestId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}
export interface AuditRepository {
  record(event: AuditEvent): Promise<void>;
  list(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse>;
}
