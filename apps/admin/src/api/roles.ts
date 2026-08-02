import type {
  CreateRoleRequest,
  PermissionOption,
  RoleOption,
  UpdateRoleRequest,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';

const base = `${window.location.protocol}//${window.location.hostname}:3001/api`;
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
  if (!response.ok) throw new Error(`Role request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
export const getPermissions = (): Promise<PermissionOption[]> => request('/roles/permissions');
export const createRole = (input: CreateRoleRequest): Promise<RoleOption> =>
  request('/roles', { method: 'POST', body: JSON.stringify(input) });
export const updateRole = (code: string, input: UpdateRoleRequest): Promise<RoleOption> =>
  request(`/roles/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(input) });
