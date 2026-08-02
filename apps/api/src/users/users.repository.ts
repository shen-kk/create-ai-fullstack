import type {
  CreateRoleRequest,
  CreateUserRequest,
  PermissionOption,
  RoleOption,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserListResponse,
  UserStatus,
  UserSummary,
} from '@template/contracts';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';

export const usersRepositoryToken = Symbol('UsersRepository');

export interface UsersRepository {
  list(query: ListUsersQueryDto): Promise<UserListResponse>;
  create(input: CreateUserRequest, passwordHash: string): Promise<UserSummary>;
  update(id: string, input: UpdateUserRequest): Promise<UserSummary | null>;
  changeStatus(id: string, status: UserStatus): Promise<UserSummary | null>;
  listRoles(): Promise<RoleOption[]>;
  assignRoles(id: string, roleCodes: string[]): Promise<UserSummary | null>;
  listPermissions(): Promise<PermissionOption[]>;
  createRole(input: CreateRoleRequest): Promise<RoleOption>;
  updateRole(code: string, input: UpdateRoleRequest): Promise<RoleOption | null>;
}
