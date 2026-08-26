import type {
  IntegrationConfigSummary,
  IntegrationKind,
  UpdateIntegrationConfigRequest,
  ServiceResourceSummary,
  UpsertServiceResourceRequest,
  ServiceFeatureBindingSummary,
  ServiceFeatureCode,
  DeleteServiceResourceResponse,
  CustomerAuthSettings,
  MessageTemplateSummary,
  UpsertMessageTemplateRequest,
  VerificationPurpose,
  UpdateCustomerAuthSettingsRequest,
} from '@template/contracts';
import { clearSession, getAccessToken } from '../auth/session';
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
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { code?: string } | null;
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent('template-auth-expired'));
    }
    throw new Error(error?.code ?? `INTEGRATION_REQUEST_${response.status}`);
  }
  return response.json() as Promise<T>;
}
export const getIntegrations = (): Promise<IntegrationConfigSummary[]> => request('/integrations');
export const getServiceResources = (kind?: IntegrationKind): Promise<ServiceResourceSummary[]> =>
  request(`/integrations/resources/list${kind ? `?kind=${kind}` : ''}`);
export const createServiceResource = (
  input: UpsertServiceResourceRequest,
): Promise<ServiceResourceSummary> =>
  request('/integrations/resources', { method: 'POST', body: JSON.stringify(input) });
export const updateServiceResource = (
  id: string,
  input: UpsertServiceResourceRequest,
): Promise<ServiceResourceSummary> =>
  request(`/integrations/resources/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const getServiceResourceSecrets = (id: string): Promise<Record<string, string>> =>
  request(`/integrations/resources/${id}/secrets`);
export const deleteServiceResource = (id: string): Promise<DeleteServiceResourceResponse> =>
  request(`/integrations/resources/${id}`, { method: 'DELETE' });
export const getServiceFeatureBindings = (): Promise<ServiceFeatureBindingSummary[]> =>
  request('/integrations/bindings/list');
export const updateServiceFeatureBinding = (
  code: ServiceFeatureCode,
  resourceId: string | null,
  templateId?: string | null,
): Promise<ServiceFeatureBindingSummary> =>
  request(`/integrations/bindings/${code}`, {
    method: 'PUT',
    body: JSON.stringify({ resourceId, ...(templateId !== undefined ? { templateId } : {}) }),
  });
export const getMessageTemplates = (): Promise<MessageTemplateSummary[]> =>
  request('/integrations/message-templates');
export const createMessageTemplate = (
  input: UpsertMessageTemplateRequest,
): Promise<MessageTemplateSummary> =>
  request('/integrations/message-templates', { method: 'POST', body: JSON.stringify(input) });
export const updateMessageTemplate = (
  id: string,
  input: UpsertMessageTemplateRequest,
): Promise<MessageTemplateSummary> =>
  request(`/integrations/message-templates/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteMessageTemplate = (id: string): Promise<{ id: string }> =>
  request(`/integrations/message-templates/${id}`, { method: 'DELETE' });
export const getCustomerAuthSettings = (): Promise<CustomerAuthSettings> =>
  request('/integrations/customer-auth/settings');
export const updateCustomerAuthSettings = (
  input: UpdateCustomerAuthSettingsRequest,
): Promise<CustomerAuthSettings> =>
  request('/integrations/customer-auth/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const updateIntegration = (
  kind: IntegrationKind,
  input: UpdateIntegrationConfigRequest,
): Promise<IntegrationConfigSummary> =>
  request(`/integrations/${kind}`, { method: 'PUT', body: JSON.stringify(input) });
export const testIntegrationDelivery = (
  kind: 'sms' | 'email',
  target: string,
  purpose: VerificationPurpose,
) =>
  request<{ expiresIn: number; retryAfter: number }>(`/integrations/${kind}/test-delivery`, {
    method: 'POST',
    body: JSON.stringify({ target, purpose }),
  });
