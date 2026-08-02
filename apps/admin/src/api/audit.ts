import type { AuditLogListQuery, AuditLogListResponse } from '@template/contracts';
import { getAccessToken } from '../auth/session';

const base = `${window.location.protocol}//${window.location.hostname}:3001/api`;
export async function getAuditLogs(query: AuditLogListQuery): Promise<AuditLogListResponse> {
  const token = getAccessToken();
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const response = await fetch(`${base}/audit-logs?${params}`, {
    signal: AbortSignal.timeout(6000),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Audit request failed: ${response.status}`);
  return response.json() as Promise<AuditLogListResponse>;
}
