import type {
  AssignUserRolesRequest,
  ChangeUserStatusRequest,
  CreateUserRequest,
  RoleOption,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserSummary,
} from '@template/contracts';
import { getAccessToken } from '../auth/session';

const configuredBaseUrl: unknown = import.meta.env['VITE_API_BASE_URL'];
const apiBaseUrl =
  typeof configuredBaseUrl === 'string'
    ? configuredBaseUrl
    : `${window.location.protocol}//${window.location.hostname}:3001/api`;

export async function getUsers(query: UserListQuery): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}/users?${params}`, {
    signal: AbortSignal.timeout(6000),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Users request failed: ${response.status}`);
  return response.json() as Promise<UserListResponse>;
}

async function writeUser(
  path: string,
  method: 'POST' | 'PATCH',
  body: CreateUserRequest | UpdateUserRequest | ChangeUserStatusRequest | AssignUserRolesRequest,
): Promise<UserSummary> {
  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(6000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`User write failed: ${response.status}`);
  return response.json() as Promise<UserSummary>;
}

export const createUser = (input: CreateUserRequest): Promise<UserSummary> =>
  writeUser('/users', 'POST', input);
export const updateUser = (id: string, input: UpdateUserRequest): Promise<UserSummary> =>
  writeUser(`/users/${encodeURIComponent(id)}`, 'PATCH', input);
export const changeUserStatus = (
  id: string,
  input: ChangeUserStatusRequest,
): Promise<UserSummary> => writeUser(`/users/${encodeURIComponent(id)}/status`, 'PATCH', input);
export const assignUserRoles = (id: string, input: AssignUserRolesRequest): Promise<UserSummary> =>
  writeUser(`/users/${encodeURIComponent(id)}/roles`, 'PATCH', input);

export async function getRoleOptions(): Promise<RoleOption[]> {
  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}/roles`, {
    signal: AbortSignal.timeout(6000),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Roles request failed: ${response.status}`);
  return response.json() as Promise<RoleOption[]>;
}
