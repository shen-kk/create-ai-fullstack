import { PermissionType, PrismaClient, UserStatus } from '@prisma/client';
import { permissionCatalog } from '@template/contracts';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function main(): Promise<void> {
  for (const permission of permissionCatalog) {
    const { code, description, groupCode } = permission;
    const type = permission.type === 'menu' ? PermissionType.MENU : PermissionType.ACTION;
    await prisma.permission.upsert({
      where: { code },
      update: { description, type, groupCode },
      create: { code, description, type, groupCode },
    });
  }

  const role = await prisma.role.upsert({
    where: { code: 'super_admin' },
    update: { name: '超级管理员', system: true },
    create: {
      code: 'super_admin',
      name: '超级管理员',
      description: '拥有模板中的全部系统权限',
      system: true,
    },
  });

  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
    skipDuplicates: true,
  });

  const phone = process.env.DEV_ADMIN_PHONE ?? '13800000000';
  const name = process.env.DEV_ADMIN_NAME ?? '模板管理员';
  const passwordHash = await hashPassword(process.env.DEV_ADMIN_PASSWORD ?? 'Admin@123456');
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      name,
      email: process.env.DEV_ADMIN_EMAIL ?? 'admin@example.com',
      status: UserStatus.ACTIVE,
    },
    create: {
      phone,
      email: process.env.DEV_ADMIN_EMAIL ?? 'admin@example.com',
      name,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}

void main()
  .catch((error: unknown) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
