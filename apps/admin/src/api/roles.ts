import type {
  CreateRoleRequest,
  PermissionOption,
  RoleOption,
  UpdateRoleRequest,
} from '@template/contracts';
import { request } from './request';
export const getPermissions = (): Promise<PermissionOption[]> => request('/roles/permissions');
export const createRole = (input: CreateRoleRequest): Promise<RoleOption> =>
  request('/roles', { method: 'POST', body: JSON.stringify(input) });
export const updateRole = (code: string, input: UpdateRoleRequest): Promise<RoleOption> =>
  request(`/roles/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(input) });
