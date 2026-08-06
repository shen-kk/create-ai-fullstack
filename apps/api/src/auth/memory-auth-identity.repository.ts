import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@template/contracts';
import { hashScryptPassword, verifyScryptPassword } from './password-hash.js';

import type { AuthIdentityRepository } from './auth-identity.repository.js';
import { project } from '../generated/project.js';

const customerPermissions = new Set([
  'menu.customers',
  'menu.verification',
  'customers.read',
  'customers.write',
  'verification.read',
]);

@Injectable()
export class MemoryAuthIdentityRepository implements AuthIdentityRepository {
  private readonly user: AuthUser = {
    id: 'adm_dev',
    name: process.env.DEV_ADMIN_NAME ?? '模板管理员',
    phone: process.env.DEV_ADMIN_PHONE ?? '13800000000',
    email: process.env.DEV_ADMIN_EMAIL ?? 'admin@example.com',
    avatarUrl: null,
    permissions: [
      'menu.dashboard',
      'menu.users',
      'menu.customers',
      'menu.roles',
      'menu.audit',
      'menu.verification',
      'menu.system',
      'menu.integrations',
      'menu.deployments',
      'users.read',
      'users.write',
      'customers.read',
      'customers.write',
      'roles.manage',
      'audit.read',
      'verification.read',
      'system.read',
      'integrations.manage',
      'deployments.read',
      'deployments.manage',
      'deployments.execute',
    ].filter(
      (permission) =>
        (project.modules.userWeb && project.modules.customerAuthentication) ||
        !customerPermissions.has(permission),
    ),
  };
  private passwordHash = hashScryptPassword(process.env.DEV_ADMIN_PASSWORD ?? 'Admin@123456');

  async authenticate(phone: string, password: string): Promise<AuthUser | null> {
    const expected = await this.passwordHash;
    if (phone !== this.user.phone || !(await verifyScryptPassword(password, expected))) return null;
    return this.user;
  }

  markActive(): Promise<void> {
    return Promise.resolve();
  }

  findActiveById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(id === this.user.id ? this.user : null);
  }
  updateProfile(id: string, name: string, avatarUrl: string | null): Promise<AuthUser | null> {
    if (id !== this.user.id) return Promise.resolve(null);
    this.user.name = name;
    this.user.avatarUrl = avatarUrl;
    return Promise.resolve(this.user);
  }
  async changePassword(
    id: string,
    currentPassword: string,
    newPasswordHash: string,
  ): Promise<boolean> {
    if (
      id !== this.user.id ||
      !(await verifyScryptPassword(currentPassword, await this.passwordHash))
    )
      return false;
    this.passwordHash = Promise.resolve(newPasswordHash);
    return true;
  }
}
