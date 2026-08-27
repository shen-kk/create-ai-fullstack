import type {
  CreateDeploymentRunRequest,
  DeploymentCheckResult,
  DeploymentEnvironmentSummary,
  DeploymentLogEntry,
  DeploymentProjectSummary,
  DeploymentReleaseSummary,
  DeploymentRunSummary,
  DeploymentWorkerStatus,
  UpsertDeploymentEnvironmentRequest,
  UpsertDeploymentProjectRequest,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new Error(body.code || body.message || `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}
export const listDeploymentProjects = () =>
  request<DeploymentProjectSummary[]>('/deployments/projects');
export const getDeploymentWorkerStatus = () =>
  request<DeploymentWorkerStatus>('/deployments/worker-status');
export const getDeploymentProject = (id: string) =>
  request<DeploymentProjectSummary>(`/deployments/projects/${id}`);
export const createDeploymentProject = (input: UpsertDeploymentProjectRequest) =>
  request<DeploymentProjectSummary>('/deployments/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateDeploymentProject = (id: string, input: UpsertDeploymentProjectRequest) =>
  request<DeploymentProjectSummary>(`/deployments/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const listDeploymentEnvironments = () =>
  request<DeploymentEnvironmentSummary[]>('/deployments/environments');
export const getDeploymentEnvironment = (id: string) =>
  request<DeploymentEnvironmentSummary>(`/deployments/environments/${id}`);
export const getDeploymentEnvironmentSecrets = (id: string) =>
  request<UpsertDeploymentEnvironmentRequest['secrets']>(`/deployments/environments/${id}/secrets`);
export const createDeploymentEnvironment = (input: UpsertDeploymentEnvironmentRequest) =>
  request<DeploymentEnvironmentSummary>('/deployments/environments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateDeploymentEnvironment = (
  id: string,
  input: UpsertDeploymentEnvironmentRequest,
) =>
  request<DeploymentEnvironmentSummary>(`/deployments/environments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const checkDeploymentGit = (id: string) =>
  request<DeploymentCheckResult>(`/deployments/environments/${id}/check-git`, { method: 'POST' });
export const checkDeploymentServer = (id: string) =>
  request<DeploymentCheckResult>(`/deployments/environments/${id}/check-server`, {
    method: 'POST',
  });
export const listDeploymentRuns = (id: string) =>
  request<DeploymentRunSummary[]>(`/deployments/environments/${id}/runs`);
export const createDeploymentRun = (id: string, input: CreateDeploymentRunRequest) =>
  request<DeploymentRunSummary>(`/deployments/environments/${id}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const getDeploymentRun = (id: string) =>
  request<DeploymentRunSummary>(`/deployments/runs/${id}`);
export const listDeploymentLogs = (id: string, after = 0) =>
  request<DeploymentLogEntry[]>(`/deployments/runs/${id}/logs?after=${after}`);
export const cancelDeploymentRun = (id: string) =>
  request<DeploymentRunSummary>(`/deployments/runs/${id}/cancel`, { method: 'POST' });
export const listDeploymentReleases = (id: string) =>
  request<DeploymentReleaseSummary[]>(`/deployments/environments/${id}/releases`);
export const rollbackDeploymentRelease = (environmentId: string, releaseId: string) =>
  request<DeploymentRunSummary>(
    `/deployments/environments/${environmentId}/releases/${releaseId}/rollback`,
    { method: 'POST' },
  );
export async function streamDeploymentRun(
  id: string,
  signal: AbortSignal,
  onEvent: (data: { run: DeploymentRunSummary; logs: DeploymentLogEntry[] }) => void,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/deployments/runs/${id}/events`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`SSE_${response.status}`);
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const line = event.split('\n').find((item) => item.startsWith('data:'));
      if (line)
        onEvent(
          JSON.parse(line.slice(5).trim()) as {
            run: DeploymentRunSummary;
            logs: DeploymentLogEntry[];
          },
        );
    }
  }
}
