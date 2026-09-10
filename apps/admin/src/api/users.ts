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
import { request, queryString } from './request';

export const getUsers = (query: UserListQuery): Promise<UserListResponse> =>
  request(`/users?${queryString(query)}`);

const writeUser = (
  path: string,
  method: 'POST' | 'PATCH',
  body: CreateUserRequest | UpdateUserRequest | ChangeUserStatusRequest | AssignUserRolesRequest,
): Promise<UserSummary> => request(path, { method, body: JSON.stringify(body) });

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

export const getRoleOptions = (): Promise<RoleOption[]> => request('/roles');
