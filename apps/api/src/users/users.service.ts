import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { project } from '../generated/project.js';

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

  async listRoles(): Promise<RoleOption[]> {
    const roles = await this.repository.listRoles();
    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.filter((code) => this.isPermissionEnabled(code)),
    }));
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

  async listPermissions(): Promise<PermissionOption[]> {
    const permissions = await this.repository.listPermissions();
    if (project.modules.userWeb && project.modules.customerAuthentication) return permissions;
    return permissions.filter((permission) => this.isPermissionGroupEnabled(permission.groupCode));
  }
  async createRole(input: CreateRoleDto, context: UserAuditContext = {}): Promise<RoleOption> {
    this.assertPermissionsEnabled(input.permissions);
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
    this.assertPermissionsEnabled(input.permissions);
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

  private isPermissionGroupEnabled(groupCode: string): boolean {
    if (project.modules.userWeb && project.modules.customerAuthentication) return true;
    return !['customers', 'verification'].includes(groupCode);
  }

  private isPermissionEnabled(code: string): boolean {
    const groupCode =
      code.startsWith('menu.customers') || code.startsWith('customers.')
        ? 'customers'
        : code.startsWith('menu.verification') || code.startsWith('verification.')
          ? 'verification'
          : '';
    return this.isPermissionGroupEnabled(groupCode);
  }

  private assertPermissionsEnabled(codes: string[]): void {
    if (codes.some((code) => !this.isPermissionEnabled(code)))
      throw new BadRequestException('PERMISSION_MODULE_DISABLED');
  }
}
