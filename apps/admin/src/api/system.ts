import type { SystemInfoResponse } from '@template/contracts';
import { request } from './request';

export const getSystemInfo = (): Promise<SystemInfoResponse> => request('/health/info');
