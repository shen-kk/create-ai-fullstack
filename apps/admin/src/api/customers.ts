import type {
  ChangeCustomerStatusRequest,
  CustomerListQuery,
  CustomerListResponse,
  CustomerSummary,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';

export async function getCustomers(query: CustomerListQuery): Promise<CustomerListResponse> {
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const response = await fetch(`${apiBaseUrl}/customers?${params}`, {
    signal: AbortSignal.timeout(6000),
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) throw new Error(`Customers request failed: ${response.status}`);
  return response.json() as Promise<CustomerListResponse>;
}

export async function changeCustomerStatus(
  id: string,
  input: ChangeCustomerStatusRequest,
): Promise<CustomerSummary> {
  const response = await fetch(`${apiBaseUrl}/customers/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Customer status update failed: ${response.status}`);
  return response.json() as Promise<CustomerSummary>;
}
