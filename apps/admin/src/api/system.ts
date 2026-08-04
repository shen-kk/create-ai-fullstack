import type { SystemInfoResponse } from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';

const base = apiBaseUrl;

export async function getSystemInfo(): Promise<SystemInfoResponse> {
  const token = getAccessToken();
  const response = await fetch(`${base}/health/info`, {
    signal: AbortSignal.timeout(6000),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`System info request failed: ${response.status}`);
  return response.json() as Promise<SystemInfoResponse>;
}
