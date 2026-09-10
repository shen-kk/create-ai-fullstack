import type {
  ChangeCustomerStatusRequest,
  CustomerListQuery,
  CustomerListResponse,
  CustomerSummary,
} from '@template/contracts';
import { request, queryString } from './request';

export const getCustomers = (query: CustomerListQuery): Promise<CustomerListResponse> =>
  request(`/customers?${queryString(query)}`);
export const changeCustomerStatus = (
  id: string,
  input: ChangeCustomerStatusRequest,
): Promise<CustomerSummary> =>
  request(`/customers/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
