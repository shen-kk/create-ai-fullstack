import type {
  VerificationDeliveryListResponse,
  VerificationDeliveryQuery,
} from '@template/contracts';
import { request, queryString } from './request';
export const getVerificationDeliveries = (
  query: VerificationDeliveryQuery,
): Promise<VerificationDeliveryListResponse> =>
  request(`/verification-deliveries?${queryString(query)}`);
