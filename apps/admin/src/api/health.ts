import type { HealthResponse } from '@template/contracts';
import { request } from './request';

export const getHealth = (): Promise<HealthResponse> => request('/health', {}, 4000);
