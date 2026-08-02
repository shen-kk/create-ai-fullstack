import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
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
import { permissionCatalog } from '@template/contracts';
import { randomUUID } from 'node:crypto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UsersRepository } from './users.repository.js';

const users: UserSummary[] = [
  {
    id: 'usr_001',
    name: '林舟',
    phone: '13800000001',
    email: 'lin.zhou@example.com',
    role: '超级管理员',
    roleCodes: ['super_admin'],
    status: 'active',
    createdAt: '2026-01-12T08:20:00.000Z',
    lastActiveAt: '2026-08-02T01:22:00.000Z',
  },
  {
    id: 'usr_002',
    name: '苏橙',
    phone: '13800000002',
    email: 'su.cheng@example.com',
    role: '运营管理员',
    roleCodes: ['operator'],
    status: 'active',
    createdAt: '2026-02-08T03:14:00.000Z',
    lastActiveAt: '2026-08-01T11:46:00.000Z',
  },
  {
    id: 'usr_003',
    name: '陈墨',
    phone: '13800000003',
    email: null,
    role: '只读人员',
    roleCodes: ['viewer'],
    status: 'pending',
    createdAt: '2026-07-28T09:30:00.000Z',
    lastActiveAt: null,
  },
  {
    id: 'usr_004',
    name: '何川',
    phone: '13800000004',
    email: 'he.chuan@example.com',
    role: '只读人员',
    roleCodes: ['viewer'],
    status: 'active',
    createdAt: '2026-03-19T06:45:00.000Z',
    lastActiveAt: '2026-07-31T15:08:00.000Z',
  },
  {
    id: 'usr_005',
    name: '许青',
    phone: '13800000005',
    email: null,
    role: '只读人员',
    roleCodes: ['viewer'],
    status: 'disabled',
    createdAt: '2026-04-02T12:10:00.000Z',
    lastActiveAt: '2026-07-18T07:36:00.000Z',
  },
  {
    id: 'usr_006',
    name: '唐宁',
    phone: '13800000006',
    email: 'tang.ning@example.com',
    role: '运营管理员',
    roleCodes: ['operator'],
    status: 'active',
    createdAt: '2026-05-16T02:25:00.000Z',
    lastActiveAt: '2026-08-01T08:19:00.000Z',
  },
  {
    id: 'usr_007',
    name: '周野',
    phone: '13800000007',
    email: null,
    role: '只读人员',
    roleCodes: ['viewer'],
    status: 'pending',
    createdAt: '2026-07-30T10:05:00.000Z',
    lastActiveAt: null,
  },
  {
    id: 'usr_008',
    name: '沈星',
    phone: '13800000008',
    email: 'shen.xing@example.com',
    role: '只读人员',
    roleCodes: ['viewer'],
    status: 'active',
    createdAt: '2026-06-21T04:42:00.000Z',
    lastActiveAt: '2026-08-02T00:51:00.000Z',
  },
];
const roles: RoleOption[] = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有全部系统权限',
    system: true,
    permissions: [
      'menu.dashboard',
      'menu.users',
      'menu.roles',
      'menu.audit',
      'menu.system',
      'menu.integrations',
      'users.read',
      'users.write',
      'roles.manage',
      'audit.read',
      'system.read',
      'integrations.manage',
    ],
  },
  {
    code: 'operator',
    name: '运营管理员',
    description: '负责日常运营',
    system: false,
    permissions: ['menu.dashboard', 'menu.users', 'users.read', 'users.write'],
  },
  {
    code: 'viewer',
    name: '只读人员',
    description: '查看后台基础信息，不允许写操作',
    system: false,
    permissions: ['menu.dashboard', 'menu.users', 'users.read'],
  },
];
const permissions: PermissionOption[] = permissionCatalog.map((permission) => ({ ...permission }));

@Injectable()
export class MemoryUsersRepository implements UsersRepository {
  list(query: ListUsersQueryDto): Promise<UserListResponse> {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    const filtered = users.filter(
      (user) =>
        (!keyword ||
          user.name.toLocaleLowerCase().includes(keyword) ||
          user.phone.includes(keyword) ||
          user.email?.toLocaleLowerCase().includes(keyword)) &&
        (!query.status || user.status === query.status),
    );
    const start = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: filtered.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    });
  }
  create(input: CreateUserRequest, passwordHash: string): Promise<UserSummary> {
    void passwordHash;
    const phone = input.phone.trim();
    if (users.some((user) => user.phone === phone))
      throw new ConflictException('PHONE_ALREADY_EXISTS');
    const user: UserSummary = {
      id: `usr_${randomUUID()}`,
      name: input.name.trim(),
      phone,
      email: input.email?.trim().toLowerCase() || null,
      role: '未分配',
      roleCodes: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    users.unshift(user);
    return Promise.resolve(user);
  }
  update(id: string, input: UpdateUserRequest): Promise<UserSummary | null> {
    const user = users.find((item) => item.id === id);
    if (!user) return Promise.resolve(null);
    const phone = input.phone.trim();
    if (users.some((item) => item.id !== id && item.phone === phone))
      throw new ConflictException('PHONE_ALREADY_EXISTS');
    user.name = input.name.trim();
    user.phone = phone;
    user.email = input.email?.trim().toLowerCase() || null;
    return Promise.resolve(user);
  }
  changeStatus(id: string, status: UserStatus): Promise<UserSummary | null> {
    const user = users.find((item) => item.id === id);
    if (!user) return Promise.resolve(null);
    user.status = status;
    return Promise.resolve(user);
  }
  listRoles(): Promise<RoleOption[]> {
    return Promise.resolve(roles);
  }
  assignRoles(id: string, roleCodes: string[]): Promise<UserSummary | null> {
    const user = users.find((item) => item.id === id);
    if (!user) return Promise.resolve(null);
    const selected = [...new Set(roleCodes)].map((code) =>
      roles.find((role) => role.code === code),
    );
    if (selected.some((role) => !role)) throw new ConflictException('ROLE_NOT_FOUND');
    const assigned = selected.flatMap((role) => (role ? [role] : []));
    user.roleCodes = assigned.map((role) => role.code);
    user.role = assigned.map((role) => role.name).join('、') || '未分配';
    return Promise.resolve(user);
  }
  listPermissions(): Promise<PermissionOption[]> {
    return Promise.resolve(permissions);
  }
  createRole(input: CreateRoleRequest): Promise<RoleOption> {
    if (roles.some((role) => role.code === input.code))
      throw new ConflictException('ROLE_CODE_ALREADY_EXISTS');
    this.assertPermissionsExist(input.permissions);
    const role: RoleOption = {
      code: input.code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      system: false,
      permissions: [...new Set(input.permissions)].sort(),
    };
    roles.push(role);
    return Promise.resolve(role);
  }
  updateRole(code: string, input: UpdateRoleRequest): Promise<RoleOption | null> {
    const role = roles.find((item) => item.code === code);
    if (!role) return Promise.resolve(null);
    if (role.system) throw new ForbiddenException('SYSTEM_ROLE_IMMUTABLE');
    this.assertPermissionsExist(input.permissions);
    role.name = input.name.trim();
    role.description = input.description?.trim() || null;
    role.permissions = [...new Set(input.permissions)].sort();
    return Promise.resolve(role);
  }
  private assertPermissionsExist(codes: string[]): void {
    if (
      [...new Set(codes)].some(
        (code) => !permissions.some((permission) => permission.code === code),
      )
    )
      throw new ConflictException('PERMISSION_NOT_FOUND');
  }
}
