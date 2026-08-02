import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserStatus as PrismaUserStatus } from '@prisma/client';
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
import type { UsersRepository } from './users.repository.js';
import { PrismaService } from '../database/prisma.service.js';

const statusToPrisma: Record<UserStatus, PrismaUserStatus> = {
  active: PrismaUserStatus.ACTIVE,
  disabled: PrismaUserStatus.DISABLED,
  pending: PrismaUserStatus.PENDING,
};
const statusFromPrisma: Record<PrismaUserStatus, UserStatus> = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  PENDING: 'pending',
};

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto): Promise<UserListResponse> {
    const keyword = query.keyword?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: statusToPrisma[query.status] } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { phone: { contains: keyword } },
              { email: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          roles: {
            include: { role: { select: { name: true, code: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((user) => this.toSummary(user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(input: CreateUserRequest, passwordHash: string): Promise<UserSummary> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim().toLowerCase() || null,
          passwordHash,
          status: PrismaUserStatus.PENDING,
        },
        include: { roles: { include: { role: { select: { name: true, code: true } } } } },
      });
      return this.toSummary(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('PHONE_ALREADY_EXISTS');
      throw error;
    }
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserSummary | null> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim().toLowerCase() || null,
        },
        include: { roles: { include: { role: { select: { name: true, code: true } } } } },
      });
      return this.toSummary(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('PHONE_ALREADY_EXISTS');
      throw error;
    }
  }

  async changeStatus(id: string, status: UserStatus): Promise<UserSummary | null> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: statusToPrisma[status] },
      include: { roles: { include: { role: { select: { name: true, code: true } } } } },
    });
    return this.toSummary(user);
  }

  async listRoles(): Promise<RoleOption[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ system: 'desc' }, { name: 'asc' }],
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    return roles.map((role) => ({
      code: role.code,
      name: role.name,
      description: role.description,
      system: role.system,
      permissions: role.permissions.map(({ permission }) => permission.code).sort(),
    }));
  }

  async assignRoles(id: string, roleCodes: string[]): Promise<UserSummary | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return null;
    const roles = await this.prisma.role.findMany({
      where: { code: { in: [...new Set(roleCodes)] } },
      select: { id: true },
    });
    if (roles.length !== new Set(roleCodes).size) throw new ConflictException('ROLE_NOT_FOUND');
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId: id } });
      if (roles.length)
        await transaction.userRole.createMany({
          data: roles.map((role) => ({ userId: id, roleId: role.id })),
        });
      return transaction.user.findUniqueOrThrow({
        where: { id },
        include: { roles: { include: { role: { select: { name: true, code: true } } } } },
      });
    });
    return this.toSummary(updated);
  }

  async listPermissions(): Promise<PermissionOption[]> {
    const items = await this.prisma.permission.findMany({
      orderBy: [{ type: 'asc' }, { groupCode: 'asc' }, { code: 'asc' }],
      select: { code: true, description: true, type: true, groupCode: true },
    });
    return items.map((item) => ({
      code: item.code,
      description: item.description,
      type: item.type === 'MENU' ? 'menu' : 'action',
      groupCode: item.groupCode,
    }));
  }

  async createRole(input: CreateRoleRequest): Promise<RoleOption> {
    const permissions = await this.resolvePermissions(input.permissions);
    try {
      const role = await this.prisma.role.create({
        data: {
          code: input.code,
          name: input.name.trim(),
          ...(input.description?.trim() ? { description: input.description.trim() } : {}),
          permissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
        include: { permissions: { include: { permission: { select: { code: true } } } } },
      });
      return {
        code: role.code,
        name: role.name,
        description: role.description,
        system: role.system,
        permissions: role.permissions.map(({ permission }) => permission.code).sort(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('ROLE_CODE_ALREADY_EXISTS');
      throw error;
    }
  }

  async updateRole(code: string, input: UpdateRoleRequest): Promise<RoleOption | null> {
    const existing = await this.prisma.role.findUnique({
      where: { code },
      select: { id: true, system: true },
    });
    if (!existing) return null;
    if (existing.system) throw new ForbiddenException('SYSTEM_ROLE_IMMUTABLE');
    const permissions = await this.resolvePermissions(input.permissions);
    const role = await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId: existing.id } });
      if (permissions.length)
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: existing.id,
            permissionId: permission.id,
          })),
        });
      return transaction.role.update({
        where: { id: existing.id },
        data: { name: input.name.trim(), description: input.description?.trim() || null },
        include: { permissions: { include: { permission: { select: { code: true } } } } },
      });
    });
    return {
      code: role.code,
      name: role.name,
      description: role.description,
      system: role.system,
      permissions: role.permissions.map(({ permission }) => permission.code).sort(),
    };
  }

  private async resolvePermissions(codes: string[]): Promise<Array<{ id: string }>> {
    const unique = [...new Set(codes)];
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: unique } },
      select: { id: true },
    });
    if (permissions.length !== unique.length) throw new ConflictException('PERMISSION_NOT_FOUND');
    return permissions;
  }

  private toSummary(
    user: Prisma.UserGetPayload<{
      include: { roles: { include: { role: { select: { name: true; code: true } } } } };
    }>,
  ): UserSummary {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.roles.map(({ role }) => role.name).join('、') || '未分配',
      roleCodes: user.roles.map(({ role }) => role.code),
      status: statusFromPrisma[user.status],
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    };
  }
}
