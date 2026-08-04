import { describe, expect, it } from 'vitest';

import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { MemoryUsersRepository } from './memory-users.repository.js';
import { UsersService } from './users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MemoryAuditRepository } from '../audit/memory-audit.repository.js';
import { project } from '../generated/project.js';

describe('UsersService', () => {
  const service = new UsersService(
    new MemoryUsersRepository(),
    new AuditService(new MemoryAuditRepository()),
  );

  it('filters by status and keyword', async () => {
    const query = Object.assign(new ListUsersQueryDto(), {
      keyword: 'su.cheng',
      status: 'active' as const,
    });
    const result = await service.list(query);
    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe('苏橙');
  });

  it('returns stable pagination metadata', async () => {
    const query = Object.assign(new ListUsersQueryDto(), { page: 2, pageSize: 3 });
    const result = await service.list(query);
    expect(result).toMatchObject({ page: 2, pageSize: 3, total: 8 });
    expect(result.items).toHaveLength(3);
  });

  it('creates a normalized pending user', async () => {
    const user = await service.create({
      name: ' 新用户 ',
      phone: '13800000101',
      email: 'NEW.USER@EXAMPLE.COM',
      password: 'StrongPass123!',
    });
    expect(user).toMatchObject({
      name: '新用户',
      phone: '13800000101',
      email: 'new.user@example.com',
      status: 'pending',
      role: '未分配',
    });
  });

  it('changes status and rejects an unknown user', async () => {
    const created = await service.create({
      name: '状态用户',
      phone: '13800000102',
      email: 'status.user@example.com',
      password: 'StrongPass123!',
    });
    await expect(service.changeStatus(created.id, { status: 'disabled' })).resolves.toMatchObject({
      status: 'disabled',
    });
    await expect(service.changeStatus('missing', { status: 'active' })).rejects.toThrow(
      'USER_NOT_FOUND',
    );
  });

  it('updates and normalizes basic profile fields', async () => {
    const created = await service.create({
      name: '编辑前',
      phone: '13800000103',
      email: 'before.edit@example.com',
      password: 'StrongPass123!',
    });
    await expect(
      service.update(created.id, {
        name: ' 编辑后 ',
        phone: '13800000104',
        email: 'AFTER.EDIT@EXAMPLE.COM',
      }),
    ).resolves.toMatchObject({
      name: '编辑后',
      phone: '13800000104',
      email: 'after.edit@example.com',
    });
    await expect(
      service.update('missing', {
        name: '不存在',
        phone: '13800000105',
        email: 'missing@example.com',
      }),
    ).rejects.toThrow('USER_NOT_FOUND');
  });

  it('assigns roles by stable codes', async () => {
    const created = await service.create({
      name: '角色用户',
      phone: '13800000106',
      email: 'role.user@example.com',
      password: 'StrongPass123!',
    });
    const roles = await service.listRoles();
    expect(roles.find((role) => role.code === 'operator')).toMatchObject({
      permissions: ['menu.dashboard', 'menu.users', 'users.read', 'users.write'],
    });
    await expect(
      service.assignRoles(created.id, { roleCodes: ['operator', 'viewer'] }),
    ).resolves.toMatchObject({ roleCodes: ['operator', 'viewer'], role: '运营管理员、只读人员' });
  });

  it('creates and updates a custom role with validated permissions', async () => {
    await expect(
      service.createRole({
        code: 'qa_reviewer',
        name: '质量审核员',
        description: '审核发布质量',
        permissions: ['users.read'],
      }),
    ).resolves.toMatchObject({ code: 'qa_reviewer', system: false, permissions: ['users.read'] });
    await expect(
      service.updateRole('qa_reviewer', {
        name: '高级质量审核员',
        permissions: ['audit.read', 'users.read'],
      }),
    ).resolves.toMatchObject({ name: '高级质量审核员', permissions: ['audit.read', 'users.read'] });
  });

  it('protects system roles from mutation', async () => {
    await expect(
      service.updateRole('super_admin', { name: '不可修改', permissions: [] }),
    ).rejects.toThrow('SYSTEM_ROLE_IMMUTABLE');
  });

  it('separates menu visibility from API action permissions', async () => {
    const permissions = await service.listPermissions();
    expect(permissions.find((item) => item.code === 'menu.users')).toMatchObject({
      type: 'menu',
      groupCode: 'users',
    });
    expect(permissions.find((item) => item.code === 'users.write')).toMatchObject({
      type: 'action',
      groupCode: 'users',
    });
  });

  it('removes user-web permissions when the user-facing application is disabled', async () => {
    const modules = project.modules as { userWeb: boolean; customerAuthentication: boolean };
    const previous = {
      userWeb: modules.userWeb,
      customerAuthentication: modules.customerAuthentication,
    };
    modules.userWeb = false;
    modules.customerAuthentication = false;
    try {
      const permissions = await service.listPermissions();
      const roles = await service.listRoles();
      expect(
        permissions.some((item) => ['customers', 'verification'].includes(item.groupCode)),
      ).toBe(false);
      expect(
        roles.some((role) =>
          role.permissions.some(
            (code) => code.startsWith('customers.') || code.startsWith('verification.'),
          ),
        ),
      ).toBe(false);
      await expect(
        service.createRole({
          code: 'invalid_customer_role',
          name: '无效用户端角色',
          permissions: ['verification.read'],
        }),
      ).rejects.toThrow('PERMISSION_MODULE_DISABLED');
    } finally {
      modules.userWeb = previous.userWeb;
      modules.customerAuthentication = previous.customerAuthentication;
    }
  });
});
