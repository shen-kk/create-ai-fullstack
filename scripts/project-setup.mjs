import { access, copyFile, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import * as prompts from '@clack/prompts';
import {
  parseEnv,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const defaultsMode = process.argv.includes('--defaults');
const dryRun = process.argv.includes('--dry-run');
const secret = () => randomBytes(32).toString('base64url');
const cancelled = (value) => {
  if (prompts.isCancel(value)) {
    prompts.cancel('已取消初始化，未写入配置。');
    process.exit(0);
  }
  return value;
};
const askText = async (message, initialValue, validate) =>
  defaultsMode
    ? String(initialValue)
    : cancelled(await prompts.text({ message, initialValue: String(initialValue), validate }));
const askPassword = async (message) =>
  defaultsMode
    ? secret()
    : cancelled(
        await prompts.password({
          message,
          mask: '•',
          validate: (value) => (value.length ? undefined : '不能为空'),
        }),
      );
const validPort = (value) =>
  Number(value) >= 1024 && Number(value) <= 65535 ? undefined : '请输入 1024–65535';
const run = (message, args) => {
  const spinner = prompts.spinner();
  spinner.start(message);
  const pnpmEntry = process.env.npm_execpath;
  const executable = pnpmEntry
    ? process.execPath
    : process.platform === 'win32'
      ? 'pnpm.cmd'
      : 'pnpm';
  const result = spawnSync(executable, pnpmEntry ? [pnpmEntry, ...args] : args, {
    cwd: new URL('../', import.meta.url),
    stdio: 'pipe',
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  if (result.status !== 0 || result.error) {
    spinner.stop(`${message}失败`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw result.error ?? new Error(`${message}失败`);
  }
  spinner.stop(`${message}完成`);
};

let existing = {};
try {
  existing = parseEnv(await readFile(new URL('.env', root), 'utf8'));
} catch {}
const config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
prompts.intro(`${config.project.displayName} · 开发环境初始化`);

const adminPort = Number(
  await askText('后台管理端口', existing.ADMIN_PORT || config.runtime.adminPort, validPort),
);
const apiPort = Number(
  await askText('API 服务端口', existing.API_PORT || config.runtime.apiPort, validPort),
);
const webPort = config.features.includes('customerWeb')
  ? Number(await askText('用户端端口', existing.WEB_PORT || config.runtime.webPort, validPort))
  : config.runtime.webPort;
if (
  new Set([adminPort, apiPort, ...(config.features.includes('customerWeb') ? [webPort] : [])])
    .size < (config.features.includes('customerWeb') ? 3 : 2)
)
  throw new Error('各应用端口不能重复');

let databaseDefaults = {
  host: '127.0.0.1',
  port: '5432',
  name: config.project.name.replaceAll('-', '_'),
  username: 'postgres',
};
try {
  const url = new URL(existing.DATABASE_URL);
  databaseDefaults = {
    host: url.hostname,
    port: url.port || '5432',
    name: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
  };
} catch {}
const databaseHost = await askText('PostgreSQL 主机', databaseDefaults.host);
const databasePort = await askText('PostgreSQL 端口', databaseDefaults.port, validPort);
const databaseName = await askText('PostgreSQL 数据库名', databaseDefaults.name, (value) =>
  value.trim() ? undefined : '不能为空',
);
const databaseUsername = await askText('PostgreSQL 用户名', databaseDefaults.username, (value) =>
  value.trim() ? undefined : '不能为空',
);
const databasePassword = await askPassword('PostgreSQL 密码');
let redisIntegration;
if (config.features.includes('customerWeb')) {
  const configureRedis = defaultsMode
    ? false
    : cancelled(
        await prompts.confirm({
          message: '验证码功能需要 Redis 能力，是否现在配置开发 Redis？',
          initialValue: false,
        }),
      );
  if (configureRedis) {
    const redisHost = await askText('Redis 主机', '127.0.0.1');
    const redisPort = await askText('Redis 端口', '6379', validPort);
    const redisUsername = await askText('Redis 用户名（没有则输入 -）', '-');
    const redisPassword = cancelled(
      await prompts.password({ message: 'Redis 密码（没有则直接回车）', mask: '•' }),
    );
    const redisDatabase = await askText('Redis 数据库序号', '0', (value) =>
      /^\d+$/.test(value) ? undefined : '请输入非负整数',
    );
    const usernamePart = redisUsername === '-' ? '' : `${encodeURIComponent(redisUsername)}@`;
    redisIntegration = {
      kind: 'redis',
      enabled: true,
      values: { url: `redis://${usernamePart}${redisHost}:${redisPort}/${redisDatabase}` },
      secrets: { password: String(redisPassword || '') },
    };
  }
}
const adminPhone = await askText(
  '初始管理员手机号',
  existing.DEV_ADMIN_PHONE || '13800000000',
  (value) => (/^1\d{10}$/.test(value) ? undefined : '请输入 11 位手机号'),
);
const adminName = await askText(
  '初始管理员姓名',
  existing.DEV_ADMIN_NAME || '系统管理员',
  (value) => (value.trim() ? undefined : '不能为空'),
);
const adminPassword = existing.DEV_ADMIN_PASSWORD || `Adm!${randomBytes(18).toString('base64url')}`;
const databaseUrl = `postgresql://${encodeURIComponent(databaseUsername)}:${encodeURIComponent(databasePassword)}@${databaseHost}:${databasePort}/${encodeURIComponent(databaseName)}?schema=public`;

const shouldWrite =
  dryRun || defaultsMode
    ? true
    : cancelled(await prompts.confirm({ message: '确认写入本地环境配置？', initialValue: true }));
if (!shouldWrite) {
  prompts.cancel('已取消初始化。');
  process.exit(0);
}
try {
  await access(new URL('.env', root), constants.F_OK);
  await copyFile(new URL('.env', root), new URL(`.env.backup-${Date.now()}`, root));
} catch {}
config.runtime = { ...config.runtime, adminPort, apiPort, webPort };
const errors = validateProjectConfig(config);
if (errors.length) throw new Error(errors.join('；'));
if (dryRun) {
  prompts.note(
    `Admin ${adminPort} · API ${apiPort}${config.features.includes('customerWeb') ? ` · Web ${webPort}` : ''}\nPostgreSQL 配置已收集，未显示或写入密码。`,
    '预览结果',
  );
  prompts.outro('DRY RUN 完成，未写入任何文件。');
  process.exit(0);
}
const env = [
  'NODE_ENV=development',
  `ADMIN_PORT=${adminPort}`,
  `API_PORT=${apiPort}`,
  `WEB_PORT=${webPort}`,
  `DATABASE_URL=${databaseUrl}`,
  `PUBLIC_API_BASE_URL=http://localhost:${apiPort}/api`,
  `ADMIN_ORIGIN=http://localhost:${adminPort}`,
  `WEB_ORIGIN=http://localhost:${webPort}`,
  `JWT_ACCESS_SECRET=${existing.JWT_ACCESS_SECRET || secret()}`,
  `JWT_REFRESH_SECRET=${existing.JWT_REFRESH_SECRET || secret()}`,
  `CUSTOMER_JWT_ACCESS_SECRET=${existing.CUSTOMER_JWT_ACCESS_SECRET || secret()}`,
  `CUSTOMER_JWT_REFRESH_SECRET=${existing.CUSTOMER_JWT_REFRESH_SECRET || secret()}`,
  `CONFIG_ENCRYPTION_KEY=${existing.CONFIG_ENCRYPTION_KEY || secret()}`,
  `DEV_ADMIN_EMAIL=${existing.DEV_ADMIN_EMAIL || 'admin@example.com'}`,
  `DEV_ADMIN_PHONE=${adminPhone}`,
  `DEV_ADMIN_NAME=${adminName}`,
  `DEV_ADMIN_PASSWORD=${adminPassword}`,
  '',
].join('\n');
await writeFile(new URL('.env', root), env, 'utf8');
const bootstrapIntegrations = [
  {
    kind: 'sql',
    enabled: true,
    values: {
      engine: 'postgresql',
      host: databaseHost,
      port: String(databasePort),
      database: databaseName,
      username: databaseUsername,
    },
    secrets: { password: databasePassword },
  },
  ...(redisIntegration ? [redisIntegration] : []),
];
await writeFile(
  new URL('.template-bootstrap.json', root),
  `${JSON.stringify({ integrations: bootstrapIntegrations }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  new URL('project.config.json', root),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);
await writeFile(new URL('docs/ai/PROJECT.md', root), renderProjectContext(config), 'utf8');
for (const path of ['apps/admin/src/generated/project.ts', 'apps/api/src/generated/project.ts'])
  await writeFile(new URL(path, root), renderRuntimeProject(config), 'utf8');
if (config.features.includes('customerWeb'))
  await writeFile(
    new URL('apps/web/app/generated/project.ts', root),
    renderRuntimeProject(config),
    'utf8',
  );

const provision = defaultsMode
  ? false
  : cancelled(
      await prompts.confirm({
        message: '立即校验数据库、执行迁移并创建管理员？',
        initialValue: true,
      }),
    );
if (provision) run('初始化数据库', ['template:provision', '--', '--yes']);
prompts.note(
  `管理员手机号：${adminPhone}\n初始密码保存在 .env 的 DEV_ADMIN_PASSWORD，首次登录后请修改。`,
  '初始化结果',
);
prompts.outro('初始化完成。运行 pnpm dev 启动项目。');
