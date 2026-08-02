import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PermissionOption,
  RoleOption,
  UserListResponse,
  UserSummary,
} from '@template/contracts';

import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { usersRepositoryToken, type UsersRepository } from './users.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ChangeUserStatusDto } from './dto/change-user-status.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { AssignUserRolesDto } from './dto/assign-user-roles.dto.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';
import { hashScryptPassword } from '../auth/password-hash.js';
import { AuditService } from '../audit/audit.service.js';

export interface UserAuditContext {
  actorId?: string;
  requestId?: string;
  ipAddress?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(usersRepositoryToken) private readonly repository: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  list(query: ListUsersQueryDto): Promise<UserListResponse> {
    return this.repository.list(query);
  }

  async create(input: CreateUserDto, context: UserAuditContext = {}): Promise<UserSummary> {
    const user = await this.repository.create(input, await hashScryptPassword(input.password));
    await this.audit.record({
      ...context,
      action: 'user.create',
      resource: 'user',
      resourceId: user.id,
      result: 'success',
    });
    return user;
  }

  async update(
    id: string,
    input: UpdateUserDto,
    context: UserAuditContext = {},
  ): Promise<UserSummary> {
    const user = await this.repository.update(id, input);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    await this.audit.record({
      ...context,
      action: 'user.update',
      resource: 'user',
      resourceId: id,
      result: 'success',
    });
    return user;
  }

  async changeStatus(
    id: string,
    input: ChangeUserStatusDto,
    context: UserAuditContext = {},
  ): Promise<UserSummary> {
    const user = await this.repository.changeStatus(id, input.status);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    await this.audit.record({
      ...context,
      action: 'user.status.change',
      resource: 'user',
      resourceId: id,
      result: 'success',
      metadata: { status: input.status },
    });
    return user;
  }

  listRoles(): Promise<RoleOption[]> {
    return this.repository.listRoles();
  }

  async assignRoles(
    id: string,
    input: AssignUserRolesDto,
    context: UserAuditContext = {},
  ): Promise<UserSummary> {
    const user = await this.repository.assignRoles(id, input.roleCodes);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    await this.audit.record({
      ...context,
      action: 'user.roles.assign',
      resource: 'user',
      resourceId: id,
      result: 'success',
      metadata: { roleCodes: input.roleCodes },
    });
    return user;
  }

  listPermissions(): Promise<PermissionOption[]> {
    return this.repository.listPermissions();
  }
  async createRole(input: CreateRoleDto, context: UserAuditContext = {}): Promise<RoleOption> {
    const role = await this.repository.createRole(input);
    await this.audit.record({
      ...context,
      action: 'role.create',
      resource: 'role',
      resourceId: role.code,
      result: 'success',
      metadata: { permissions: input.permissions },
    });
    return role;
  }
  async updateRole(
    code: string,
    input: UpdateRoleDto,
    context: UserAuditContext = {},
  ): Promise<RoleOption> {
    const role = await this.repository.updateRole(code, input);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    await this.audit.record({
      ...context,
      action: 'role.update',
      resource: 'role',
      resourceId: code,
      result: 'success',
      metadata: { permissions: input.permissions },
    });
    return role;
  }
}
