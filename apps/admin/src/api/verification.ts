import type {
  VerificationDeliveryListResponse,
  VerificationDeliveryQuery,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';
const base = apiBaseUrl;
export async function getVerificationDeliveries(
  query: VerificationDeliveryQuery,
): Promise<VerificationDeliveryListResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const response = await fetch(`${base}/verification-deliveries?${params}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) throw new Error('VERIFICATION_DELIVERIES_FAILED');
  return response.json() as Promise<VerificationDeliveryListResponse>;
}
