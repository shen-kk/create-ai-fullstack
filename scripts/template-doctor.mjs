import { constants } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import process from 'node:process';
import {
  parseEnv,
  renderAdminFeatureRoutes,
  renderApiFeatureModules,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const checks = [];
const add = (status, name, detail) => checks.push({ status, name, detail });
const exists = async (path) => {
  try {
    await access(new URL(path, root), constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

let config;
try {
  config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
  const errors = validateProjectConfig(config);
  add(errors.length ? 'FAIL' : 'PASS', '项目声明', errors.length ? errors.join('；') : '配置有效');
} catch {
  add('FAIL', '项目声明', 'project.config.json 缺失或 JSON 无效');
}

add((await exists('AGENTS.md')) ? 'PASS' : 'FAIL', 'AI 入口', 'AGENTS.md');
add((await exists('docs/ai/CONTEXT.md')) ? 'PASS' : 'FAIL', 'AI 上下文', 'docs/ai/CONTEXT.md');

if (config) {
  try {
    const actual = await readFile(new URL('docs/ai/PROJECT.md', root), 'utf8');
    add(
      actual === renderProjectContext(config) ? 'PASS' : 'FAIL',
      'AI 项目记忆',
      actual === renderProjectContext(config) ? '与项目声明一致' : '请运行 pnpm template:sync',
    );
  } catch {
    add('FAIL', 'AI 项目记忆', '缺少 docs/ai/PROJECT.md');
  }

  const expected = renderRuntimeProject(config);
  const runtimePaths = [
    'apps/admin/src/generated/project.ts',
    'apps/api/src/generated/project.ts',
    ...(config.features?.includes('customerWeb') ? ['apps/web/app/generated/project.ts'] : []),
  ];
  for (const path of runtimePaths) {
    try {
      const actual = await readFile(new URL(path, root), 'utf8');
      add(
        actual === expected ? 'PASS' : 'FAIL',
        `运行时能力 ${path}`,
        actual === expected ? '已同步' : '请运行 pnpm template:sync',
      );
    } catch {
      add('FAIL', `运行时能力 ${path}`, '文件缺失');
    }
  }
  for (const [path, expectedContent] of [
    ['apps/admin/src/generated/feature-routes.ts', renderAdminFeatureRoutes(config)],
    ['apps/api/src/generated/feature-modules.ts', renderApiFeatureModules(config)],
  ]) {
    try {
      const actual = await readFile(new URL(path, root), 'utf8');
      add(
        actual === expectedContent ? 'PASS' : 'FAIL',
        `功能入口 ${path}`,
        actual === expectedContent ? '已同步' : '请运行 pnpm template:sync',
      );
    } catch {
      add('FAIL', `功能入口 ${path}`, '文件缺失');
    }
  }
}

add((await exists('.env.example')) ? 'PASS' : 'FAIL', '环境变量示例', '.env.example');
add((await exists('node_modules')) ? 'PASS' : 'WARN', '项目依赖', '未安装时运行 pnpm install');

try {
  const migrations = await readdir(new URL('apps/api/prisma/migrations/', root), {
    withFileTypes: true,
  });
  const directories = migrations.filter((entry) => entry.isDirectory());
  const missing = [];
  for (const migration of directories)
    if (!(await exists(`apps/api/prisma/migrations/${migration.name}/migration.sql`)))
      missing.push(migration.name);
  add(
    missing.length ? 'FAIL' : 'PASS',
    'Prisma 迁移完整性',
    missing.length
      ? `缺少 migration.sql：${missing.join(', ')}`
      : `${directories.length} 个迁移目录完整`,
  );
} catch {
  add('FAIL', 'Prisma 迁移完整性', '无法读取迁移目录');
}

try {
  const env = parseEnv(await readFile(new URL('.env', root), 'utf8'));
  add('PASS', '本地环境变量', '.env 已生成且应被 Git 忽略');
  add(
    env.DATABASE_URL?.startsWith('postgresql://') || env.DATABASE_URL?.startsWith('postgres://')
      ? 'PASS'
      : 'FAIL',
    '数据库地址',
    '必须提供 PostgreSQL URL',
  );
  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CUSTOMER_JWT_ACCESS_SECRET',
    'CUSTOMER_JWT_REFRESH_SECRET',
    'CONFIG_ENCRYPTION_KEY',
  ])
    add((env[key]?.length ?? 0) >= 32 ? 'PASS' : 'FAIL', key, '必须至少 32 个字符');
  add(
    /^1\d{10}$/.test(env.DEV_ADMIN_PHONE ?? '') ? 'PASS' : 'FAIL',
    '管理员手机号',
    env.DEV_ADMIN_PHONE || '未配置',
  );
  add(
    (env.DEV_ADMIN_PASSWORD?.length ?? 0) >= 12 ? 'PASS' : 'FAIL',
    '初始管理员密码',
    '必须至少 12 个字符',
  );
} catch {
  add('FAIL', '本地环境变量', '缺少 .env，请先运行 pnpm run setup');
}

if (await exists('.template-bootstrap.json'))
  add('WARN', '一次性服务密钥', '等待 pnpm template:provision 加密入库');
for (const item of checks) console.log(`[${item.status}] ${item.name} - ${item.detail}`);
const failed = checks.filter((item) => item.status === 'FAIL').length;
const warned = checks.filter((item) => item.status === 'WARN').length;
console.log(
  `\n检查完成：${checks.length - failed - warned} 通过，${warned} 警告，${failed} 失败。`,
);
if (failed) process.exitCode = 1;
