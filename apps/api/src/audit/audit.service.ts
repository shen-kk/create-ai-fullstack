import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogListResponse } from '@template/contracts';
import { auditRepositoryToken, type AuditEvent, type AuditRepository } from './audit.repository.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

@Injectable()
export class AuditService {
  constructor(@Inject(auditRepositoryToken) private readonly repository: AuditRepository) {}
  record(event: AuditEvent): Promise<void> {
    return this.repository.record(event);
  }
  list(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    return this.repository.list(query);
  }
}
