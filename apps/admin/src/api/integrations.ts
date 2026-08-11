import type {
  IntegrationConfigSummary,
  IntegrationKind,
  UpdateIntegrationConfigRequest,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';
const base = apiBaseUrl;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(6000),
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`Integration request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
export const getIntegrations = (): Promise<IntegrationConfigSummary[]> => request('/integrations');
export const updateIntegration = (
  kind: IntegrationKind,
  input: UpdateIntegrationConfigRequest,
): Promise<IntegrationConfigSummary> =>
  request(`/integrations/${kind}`, { method: 'PUT', body: JSON.stringify(input) });
export const testIntegrationDelivery = (kind: 'sms' | 'email', target: string) =>
  request<{ expiresIn: number; retryAfter: number }>(`/integrations/${kind}/test-delivery`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
