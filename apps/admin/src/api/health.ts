import type { HealthResponse } from '@template/contracts';

const configuredBaseUrl: unknown = import.meta.env['VITE_API_BASE_URL'];
const apiBaseUrl =
  typeof configuredBaseUrl === 'string'
    ? configuredBaseUrl
    : `${window.location.protocol}//${window.location.hostname}:3001/api`;

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Health request failed: ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
