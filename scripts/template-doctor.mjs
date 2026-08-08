import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import process from 'node:process';
import {
  parseEnv,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url),
  checks = [];
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
  add(
    errors.length ? 'FAIL' : 'PASS',
    '项目声明',
    errors.length ? errors.join('；') : '结构与能力声明有效',
  );
} catch {
  add('FAIL', '项目声明', 'project.config.json 缺失或 JSON 无效');
}
add((await exists('AGENTS.md')) ? 'PASS' : 'FAIL', 'AI 入口', 'AGENTS.md');
add((await exists('docs/ai/CONTEXT.md')) ? 'PASS' : 'FAIL', 'AI 上下文', 'docs/ai/CONTEXT.md');
if (config) {
  try {
    const projectContext = await readFile(new URL('docs/ai/PROJECT.md', root), 'utf8');
    add(
      projectContext === renderProjectContext(config) ? 'PASS' : 'FAIL',
      'AI 项目记忆',
      projectContext === renderProjectContext(config)
        ? '与 project.config.json 一致'
        : '内容过期，请运行 pnpm template:sync',
    );
  } catch {
    add('FAIL', 'AI 项目记忆', '缺少 docs/ai/PROJECT.md，请运行 pnpm template:sync');
  }
  const runtimeExpected = renderRuntimeProject(config);
  for (const path of [
    'apps/admin/src/generated/project.ts',
    'apps/api/src/generated/project.ts',
    'apps/web/app/generated/project.ts',
  ]) {
    try {
      const runtime = await readFile(new URL(path, root), 'utf8');
      add(
        runtime === runtimeExpected ? 'PASS' : 'FAIL',
        `运行时能力 ${path.includes('/admin/') ? 'Admin' : path.includes('/web/') ? 'Web' : 'API'}`,
        runtime === runtimeExpected ? '与项目声明一致' : '内容过期，请运行 pnpm template:sync',
      );
    } catch {
      add('FAIL', '运行时能力', `缺少 ${path}`);
    }
  }
}
add((await exists('.env.example')) ? 'PASS' : 'FAIL', '环境变量示例', '.env.example');
add((await exists('node_modules')) ? 'PASS' : 'WARN', '项目依赖', '未安装时执行 pnpm install');
try {
  const migrations = await readdir(new URL('apps/api/prisma/migrations/', root), {
    withFileTypes: true,
  });
  const missing = [];
  for (const migration of migrations.filter((entry) => entry.isDirectory()))
    if (!(await exists(`apps/api/prisma/migrations/${migration.name}/migration.sql`)))
      missing.push(migration.name);
  add(
    missing.length ? 'FAIL' : 'PASS',
    'Prisma 迁移完整性',
    missing.length
      ? `缺少 migration.sql：${missing.join(', ')}`
      : `${migrations.filter((entry) => entry.isDirectory()).length} 个迁移目录完整`,
  );
} catch {
  add('FAIL', 'Prisma 迁移完整性', '无法读取迁移目录');
}
try {
  const env = parseEnv(await readFile(new URL('.env', root), 'utf8'));
  add('PASS', '本地环境变量', '.env 已生成且被 Git 忽略');
  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CUSTOMER_JWT_ACCESS_SECRET',
    'CUSTOMER_JWT_REFRESH_SECRET',
    'CONFIG_ENCRYPTION_KEY',
  ])
    add(
      (env[key]?.length ?? 0) >= 32 ? 'PASS' : 'FAIL',
      key,
      (env[key]?.length ?? 0) >= 32 ? '长度符合要求' : '必须至少 32 个字符',
    );
  add(
    /^1\d{10}$/.test(env.DEV_ADMIN_PHONE ?? '') ? 'PASS' : 'FAIL',
    '管理员手机号',
    env.DEV_ADMIN_PHONE || '未配置',
  );
  add(
    (env.DEV_ADMIN_PASSWORD?.length ?? 0) >= 12 ? 'PASS' : 'FAIL',
    '初始管理员密码',
    (env.DEV_ADMIN_PASSWORD?.length ?? 0) >= 12 ? '长度符合要求且不回显内容' : '必须至少 12 个字符',
  );
  if (config?.database?.mode === 'prisma')
    add(
      env.DATABASE_URL?.startsWith('postgresql://') || env.DATABASE_URL?.startsWith('postgres://')
        ? 'PASS'
        : 'FAIL',
      '数据库地址',
      'Prisma 模式要求 PostgreSQL URL',
    );
  add(
    env.DATA_SOURCE === 'prisma' && config?.database?.mode === 'prisma' ? 'PASS' : 'FAIL',
    '数据源一致性',
    `.env=${env.DATA_SOURCE ?? '未配置'} / 声明=${config?.database?.mode ?? '未知'}`,
  );
} catch {
  add('FAIL', '本地环境变量', '缺少 .env，请先运行 pnpm template:init');
}
if (await exists('.template-bootstrap.json'))
  add(
    'WARN',
    '一次性服务密钥',
    '等待加密入库；修正连接后运行 pnpm template:provision，成功后会自动删除',
  );
for (const item of checks) console.log(`[${item.status}] ${item.name} - ${item.detail}`);
const failed = checks.filter((item) => item.status === 'FAIL').length,
  warned = checks.filter((item) => item.status === 'WARN').length;
console.log(
  `\n检查完成：${checks.length - failed - warned} 通过，${warned} 警告，${failed} 失败。`,
);
if (failed) process.exitCode = 1;
