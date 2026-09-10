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
import { request as apiRequest, requestResponse } from './request';

const request = <T>(path: string, init?: RequestInit): Promise<T> => apiRequest(path, init, 20_000);
export const listDeploymentProjects = () =>
  request<DeploymentProjectSummary[]>('/deployments/projects');
export const getDeploymentWorkerStatus = () =>
  request<DeploymentWorkerStatus>('/deployments/worker-status');
export const getDeploymentProject = (id: string) =>
  request<DeploymentProjectSummary>(`/deployments/projects/${encodeURIComponent(id)}`);
export const createDeploymentProject = (input: UpsertDeploymentProjectRequest) =>
  request<DeploymentProjectSummary>('/deployments/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateDeploymentProject = (id: string, input: UpsertDeploymentProjectRequest) =>
  request<DeploymentProjectSummary>(`/deployments/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const listDeploymentEnvironments = () =>
  request<DeploymentEnvironmentSummary[]>('/deployments/environments');
export const getDeploymentEnvironment = (id: string) =>
  request<DeploymentEnvironmentSummary>(`/deployments/environments/${encodeURIComponent(id)}`);
export const getDeploymentEnvironmentSecrets = (id: string) =>
  request<UpsertDeploymentEnvironmentRequest['secrets']>(
    `/deployments/environments/${encodeURIComponent(id)}/secrets`,
  );
export const createDeploymentEnvironment = (input: UpsertDeploymentEnvironmentRequest) =>
  request<DeploymentEnvironmentSummary>('/deployments/environments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateDeploymentEnvironment = (
  id: string,
  input: UpsertDeploymentEnvironmentRequest,
) =>
  request<DeploymentEnvironmentSummary>(`/deployments/environments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const checkDeploymentGit = (id: string) =>
  request<DeploymentCheckResult>(`/deployments/environments/${encodeURIComponent(id)}/check-git`, {
    method: 'POST',
  });
export const checkDeploymentServer = (id: string) =>
  request<DeploymentCheckResult>(
    `/deployments/environments/${encodeURIComponent(id)}/check-server`,
    {
      method: 'POST',
    },
  );
export const listDeploymentRuns = (id: string) =>
  request<DeploymentRunSummary[]>(`/deployments/environments/${encodeURIComponent(id)}/runs`);
export const createDeploymentRun = (id: string, input: CreateDeploymentRunRequest) =>
  request<DeploymentRunSummary>(`/deployments/environments/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const getDeploymentRun = (id: string) =>
  request<DeploymentRunSummary>(`/deployments/runs/${encodeURIComponent(id)}`);
export const listDeploymentLogs = (id: string, after = 0) =>
  request<DeploymentLogEntry[]>(`/deployments/runs/${encodeURIComponent(id)}/logs?after=${after}`);
export const cancelDeploymentRun = (id: string) =>
  request<DeploymentRunSummary>(`/deployments/runs/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
export const listDeploymentReleases = (id: string) =>
  request<DeploymentReleaseSummary[]>(
    `/deployments/environments/${encodeURIComponent(id)}/releases`,
  );
export const rollbackDeploymentRelease = (environmentId: string, releaseId: string) =>
  request<DeploymentRunSummary>(
    `/deployments/environments/${encodeURIComponent(environmentId)}/releases/${encodeURIComponent(releaseId)}/rollback`,
    { method: 'POST' },
  );
export async function streamDeploymentRun(
  id: string,
  signal: AbortSignal,
  onEvent: (data: { run: DeploymentRunSummary; logs: DeploymentLogEntry[] }) => void,
): Promise<void> {
  const response = await requestResponse(`/deployments/runs/${encodeURIComponent(id)}/events`, {
    headers: { Accept: 'text/event-stream' },
    signal,
  });
  if (!response.body) throw new Error('SSE_BODY_MISSING');
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
