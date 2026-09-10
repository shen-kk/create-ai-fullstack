import type { AuditLogListQuery, AuditLogListResponse } from '@template/contracts';
import { request, queryString } from './request';
export const getAuditLogs = (query: AuditLogListQuery): Promise<AuditLogListResponse> =>
  request(`/audit-logs?${queryString(query)}`);
