import { Injectable } from '@nestjs/common';
import { UserStatus, type Prisma } from '@prisma/client';
import type { AuthUser } from '@template/contracts';

import type { AuthIdentityRepository } from './auth-identity.repository.js';
import { verifyScryptPassword } from './password-hash.js';
import { PrismaService } from '../database/prisma.service.js';

const identityInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
        },
      },
    },
  },
} as const;
type IdentityRecord = Prisma.UserGetPayload<{ include: typeof identityInclude }>;

@Injectable()
export class PrismaAuthIdentityRepository implements AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(phone: string, password: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { phone: phone.trim() },
      include: identityInclude,
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await verifyScryptPassword(password, user.passwordHash))
    )
      return null;
    return this.toAuthUser(user);
  }

  async markActive(id: string, activeAt: Date): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastActiveAt: activeAt } });
  }

  async findActiveById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, status: UserStatus.ACTIVE },
      include: identityInclude,
    });
    return user ? this.toAuthUser(user) : null;
  }

  async updateProfile(
    id: string,
    name: string,
    avatarUrl: string | null,
  ): Promise<AuthUser | null> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) return null;
    const user = await this.prisma.user.update({
      where: { id },
      data: { name, avatarUrl },
      include: identityInclude,
    });
    return this.toAuthUser(user);
  }
  async changePassword(
    id: string,
    currentPassword: string,
    newPasswordHash: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyScryptPassword(currentPassword, user.passwordHash))) return false;
    await this.prisma.user.update({ where: { id }, data: { passwordHash: newPasswordHash } });
    return true;
  }

  private toAuthUser(user: IdentityRecord): AuthUser {
    const permissions = [
      ...new Set(
        user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)),
      ),
    ].sort();
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      permissions,
    };
  }
}
