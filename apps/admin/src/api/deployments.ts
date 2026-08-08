import type {
  CreateDeploymentRunRequest,
  DeploymentConnectionTestResult,
  DeploymentRunSummary,
  DeploymentTargetSummary,
  UpsertDeploymentTargetRequest,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    const error = new Error(payload?.code || `Deployment request failed: ${response.status}`);
    error.name = 'DeploymentApiError';
    throw error;
  }
  return response.json() as Promise<T>;
}

export const getDeploymentTargets = (): Promise<DeploymentTargetSummary[]> =>
  request('/deployments');
export const createDeploymentTarget = (
  input: UpsertDeploymentTargetRequest,
): Promise<DeploymentTargetSummary> =>
  request('/deployments', { method: 'POST', body: JSON.stringify(input) });
export const updateDeploymentTarget = (
  id: string,
  input: UpsertDeploymentTargetRequest,
): Promise<DeploymentTargetSummary> =>
  request(`/deployments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const testDeploymentConnection = (id: string): Promise<DeploymentConnectionTestResult> =>
  request(`/deployments/${encodeURIComponent(id)}/test-connection`, { method: 'POST' });
export const getDeploymentRuns = (id: string): Promise<DeploymentRunSummary[]> =>
  request(`/deployments/${encodeURIComponent(id)}/runs`);
export const startDeploymentRun = (
  id: string,
  input: CreateDeploymentRunRequest,
): Promise<DeploymentRunSummary> =>
  request(`/deployments/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
