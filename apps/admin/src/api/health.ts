import type { HealthResponse } from '@template/contracts';
import { apiBaseUrl } from './base';

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Health request failed: ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
