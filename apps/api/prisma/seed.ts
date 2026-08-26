import { PermissionType, PrismaClient, UserStatus } from '@prisma/client';
import type { DeployEnvironmentKind } from '@prisma/client';
import { permissionCatalog } from '@template/contracts';
import { createCipheriv, createHash, randomBytes, scrypt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { project } from '../src/generated/project.js';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

interface BootstrapIntegration {
  kind: string;
  enabled: boolean;
  values: Record<string, string>;
  secrets: Record<string, string>;
}

interface BootstrapDeploymentEnvironment {
  name: string;
  kind: string;
  applications: string[];
  gitProvider: string;
  repositoryUrl: string;
  gitRef?: string;
  gitAuthMode: string;
  host: string;
  sshPort?: number;
  sshUser: string;
  sshAuthMode: string;
  deployPath: string;
  adminUrl?: string;
  apiUrl?: string;
  webUrl?: string;
  healthCheckUrl?: string;
  retainReleases?: number;
  secrets?: Record<string, string>;
}

function encryptSecrets(value: Record<string, string>): string {
  const key = createHash('sha256')
    .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

async function seedIntegrationConfigs(): Promise<void> {
  const path = process.env.TEMPLATE_BOOTSTRAP_FILE;
  if (!path) return;
  const source = JSON.parse(await readFile(path, 'utf8')) as {
    integrations?: BootstrapIntegration[];
  };
  for (const item of source.integrations ?? []) {
    const secrets = Object.fromEntries(
      Object.entries(item.secrets).filter(([, value]) => value.trim().length > 0),
    );
    await prisma.integrationConfig.upsert({
      where: { kind: item.kind },
      create: {
        kind: item.kind,
        enabled: item.enabled,
        values: item.values,
        encryptedSecrets: encryptSecrets(secrets),
      },
      update: {
        enabled: item.enabled,
        values: item.values,
        encryptedSecrets: encryptSecrets(secrets),
      },
    });
    if (item.kind === 'sql' || item.kind === 'redis') {
      const name = item.kind === 'sql' ? '开发数据库' : '开发 Redis';
      const provider = item.kind === 'sql' ? item.values.engine || 'postgresql' : 'redis';
      await prisma.serviceResource.upsert({
        where: { kind_name: { kind: item.kind, name } },
        create: {
          name,
          kind: item.kind,
          provider,
          enabled: true,
          values: item.values,
          encryptedSecrets: encryptSecrets(secrets),
        },
        update: {
          provider,
          enabled: true,
          values: item.values,
          encryptedSecrets: encryptSecrets(secrets),
        },
      });
    }
  }
}

async function seedDeploymentEnvironment(): Promise<void> {
  const project = await prisma.deployProject.upsert({
    where: { code: 'aiforge-fullstack' },
    update: {
      description: '基于不可变版本目录、current 软链接与 PM2 进程管理的 AIForge 发布预设。',
      type: 'release-directory',
      installCommand: 'pnpm install --frozen-lockfile',
      units: [
        {
          key: 'admin',
          name: '后台管理',
          buildCommand: 'pnpm --filter @template/admin build',
          migrationCommand: null,
          restartCommand: 'true',
          healthCheckUrl: null,
        },
        {
          key: 'api',
          name: 'API 服务',
          buildCommand: 'pnpm --filter @template/api build',
          migrationCommand: 'pnpm --filter @template/api exec prisma migrate deploy',
          restartCommand: 'pm2 startOrReload ecosystem.config.cjs --only aiforge-api --update-env',
          healthCheckUrl: null,
        },
        {
          key: 'web',
          name: '用户端',
          buildCommand: 'pnpm --filter @template/web build',
          migrationCommand: null,
          restartCommand: 'pm2 startOrReload ecosystem.config.cjs --only aiforge-web --update-env',
          healthCheckUrl: null,
        },
      ],
      variables: [],
      system: true,
    },
    create: {
      name: 'AIForge 全栈项目',
      code: 'aiforge-fullstack',
      description: '基于不可变版本目录、current 软链接与 PM2 进程管理的 AIForge 发布预设。',
      type: 'release-directory',
      installCommand: 'pnpm install --frozen-lockfile',
      units: [
        {
          key: 'admin',
          name: '后台管理',
          buildCommand: 'pnpm --filter @template/admin build',
          migrationCommand: null,
          restartCommand: 'true',
          healthCheckUrl: null,
        },
        {
          key: 'api',
          name: 'API 服务',
          buildCommand: 'pnpm --filter @template/api build',
          migrationCommand: 'pnpm --filter @template/api exec prisma migrate deploy',
          restartCommand: 'pm2 startOrReload ecosystem.config.cjs --only aiforge-api --update-env',
          healthCheckUrl: null,
        },
        {
          key: 'web',
          name: '用户端',
          buildCommand: 'pnpm --filter @template/web build',
          migrationCommand: null,
          restartCommand: 'pm2 startOrReload ecosystem.config.cjs --only aiforge-web --update-env',
          healthCheckUrl: null,
        },
      ],
      variables: [],
      system: true,
    },
  });
  const path = process.env.TEMPLATE_BOOTSTRAP_FILE;
  if (!path) return;
  const source = JSON.parse(await readFile(path, 'utf8')) as {
    deploymentEnvironment?: BootstrapDeploymentEnvironment;
  };
  const item = source.deploymentEnvironment;
  if (!item) return;
  const secrets = Object.fromEntries(
    Object.entries(item.secrets ?? {}).filter(([, value]) => value.trim().length > 0),
  );
  const optionalUrls = {
    adminUrl: item.adminUrl ?? null,
    apiUrl: item.apiUrl ?? null,
    webUrl: item.webUrl ?? null,
    healthCheckUrl: item.healthCheckUrl ?? null,
  };
  await prisma.deployEnvironment.upsert({
    where: { name: item.name },
    create: {
      name: item.name,
      kind: item.kind as DeployEnvironmentKind,
      projectId: project.id,
      applications: item.applications,
      environmentValues: {},
      gitProvider: item.gitProvider,
      repositoryUrl: item.repositoryUrl,
      gitRef: item.gitRef ?? 'main',
      gitAuthMode: item.gitAuthMode,
      host: item.host,
      sshPort: item.sshPort ?? 22,
      sshUser: item.sshUser,
      sshAuthMode: item.sshAuthMode,
      deployPath: item.deployPath,
      ...optionalUrls,
      retainReleases: item.retainReleases ?? 5,
      encryptedSecrets: encryptSecrets(secrets),
    },
    update: {
      applications: item.applications,
      repositoryUrl: item.repositoryUrl,
      gitRef: item.gitRef ?? 'main',
      host: item.host,
      sshPort: item.sshPort ?? 22,
      sshUser: item.sshUser,
      deployPath: item.deployPath,
      ...optionalUrls,
      retainReleases: item.retainReleases ?? 5,
      encryptedSecrets: encryptSecrets(secrets),
    },
  });
}

async function main(): Promise<void> {
  const customerGroups = new Set(['customers', 'verification']);
  const deploymentGroups = new Set(['deployments']);
  const userWebEnabled = project.modules.userWeb && project.modules.customerAuthentication;
  const enabledPermissions = permissionCatalog.filter(
    (permission) =>
      (userWebEnabled || !customerGroups.has(permission.groupCode)) &&
      (project.modules.deploymentCenter || !deploymentGroups.has(permission.groupCode)),
  );
  const disabledPermissionCodes = permissionCatalog
    .filter(
      (permission) =>
        (!userWebEnabled && customerGroups.has(permission.groupCode)) ||
        (!project.modules.deploymentCenter && deploymentGroups.has(permission.groupCode)),
    )
    .map((permission) => permission.code);
  await prisma.permission.deleteMany({
    where: { code: { in: disabledPermissionCodes } },
  });
  for (const permission of enabledPermissions) {
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

  const phone = process.env.DEV_ADMIN_PHONE?.trim();
  const password = process.env.DEV_ADMIN_PASSWORD;
  if (!phone || !/^1\d{10}$/.test(phone))
    throw new Error('DEV_ADMIN_PHONE must be an explicit 11-digit mobile number');
  if (!password || password.length < 12)
    throw new Error('DEV_ADMIN_PASSWORD must be explicitly configured with at least 12 characters');
  const name = process.env.DEV_ADMIN_NAME ?? '模板管理员';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { phone },
    // Project provisioning treats DEV_ADMIN_PASSWORD as the authoritative
    // recovery credential. Re-running setup/provision intentionally resets
    // the initial administrator password without overwriting profile/status.
    update: { passwordHash },
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
  await seedIntegrationConfigs();
  await seedDeploymentEnvironment();
}

void main()
  .catch((error: unknown) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
