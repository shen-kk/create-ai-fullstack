import { access, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  presetModules,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const args = new Set(process.argv.slice(2));
const defaultsMode = args.has('--defaults');
const dryRun = args.has('--dry-run');
const presetArgument = process.argv
  .slice(2)
  .find((item) => item.startsWith('--preset='))
  ?.split('=')[1];
const rl = defaultsMode
  ? undefined
  : createInterface({ input: process.stdin, output: process.stdout });
const ask = async (label, fallback, validate = () => true) => {
  if (!rl) return String(fallback);
  while (true) {
    const value = (await rl.question(`${label} (${fallback}): `)).trim() || String(fallback);
    if (validate(value)) return value;
    console.log('输入格式不正确，请重新输入。');
  }
};
const yes = async (label, fallback = true) =>
  ['y', 'yes', '是'].includes(
    (await ask(`${label} [${fallback ? 'Y/n' : 'y/N'}]`, fallback ? 'y' : 'n')).toLowerCase(),
  );
const choose = async (label, options, fallbackIndex = 0) => {
  if (rl) {
    console.log(`\n${label}`);
    options.forEach((item, index) => console.log(`  ${index + 1}. ${item.label}`));
  }
  const answer = Number(
    await ask(
      '请选择序号',
      fallbackIndex + 1,
      (value) => Number(value) >= 1 && Number(value) <= options.length,
    ),
  );
  return options[answer - 1].value;
};
const secret = () => randomBytes(32).toString('base64url');
const formatWorkspaceIfAvailable = async () => {
  const prettierUrl = new URL('node_modules/prettier/bin/prettier.cjs', root);
  try {
    await access(prettierUrl, constants.F_OK);
  } catch {
    console.log('[SKIP] 依赖尚未安装；安装后运行 pnpm format 以规范化命名空间替换结果');
    return;
  }
  const result = spawnSync(process.execPath, [fileURLToPath(prettierUrl), '--write', '.'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('初始化后的代码格式化失败');
  console.log('[FORMAT] 已规范化命名空间替换后的项目文件');
};
const replaceWorkspaceScope = async (nextScope) => {
  const contractsPackage = JSON.parse(
    await readFile(new URL('packages/contracts/package.json', root), 'utf8'),
  );
  const currentScope = String(contractsPackage.name).split('/')[0];
  if (currentScope === nextScope) return;
  const allowed = /\.(?:ts|vue|json|html|mjs|yaml|yml)$/;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.nuxt', '.output'].includes(entry.name)) continue;
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) await visit(url);
      else if (allowed.test(entry.name)) {
        const source = await readFile(url, 'utf8');
        if (source.includes(`${currentScope}/`))
          await writeFile(url, source.replaceAll(`${currentScope}/`, `${nextScope}/`), 'utf8');
      }
    }
  };
  await visit(new URL('apps/', root));
  await visit(new URL('packages/', root));
  for (const path of ['package.json', 'pnpm-lock.yaml', 'turbo.json']) {
    const url = new URL(path, root);
    const source = await readFile(url, 'utf8');
    if (source.includes(`${currentScope}/`))
      await writeFile(url, source.replaceAll(`${currentScope}/`, `${nextScope}/`), 'utf8');
  }
  console.log(`[RENAME] 工作区包命名空间 ${currentScope} → ${nextScope}`);
};

try {
  console.log('\nAdminback 模板初始化\n敏感信息只写入本机 .env，不会写入 project.config.json。\n');
  const preset =
    presetArgument ??
    (await choose('初始化模式', [
      { value: 'quick', label: '快速：内存预览，最少外部依赖' },
      { value: 'standard', label: '标准：PostgreSQL、Redis、对象存储和邮件能力' },
      { value: 'custom', label: '自定义：逐项选择基础能力' },
    ]));
  if (!['quick', 'standard', 'custom'].includes(preset))
    throw new Error('PRESET_INVALID：仅支持 quick、standard、custom');
  const name = await ask('项目英文名称', 'admin-project', (value) =>
    /^[a-z][a-z0-9-]{1,62}$/.test(value),
  );
  const packageScope = await ask('包命名空间', `@${name}`, (value) =>
    /^@[a-z][a-z0-9-]{1,62}$/.test(value),
  );
  const displayName = await ask(
    '项目显示名称',
    '后台管理系统',
    (value) => value.length >= 2 && value.length <= 80,
  );
  const description = await ask('项目简介', '内部运营后台');
  const adminPort = Number(
    await ask('后台端口', 3000, (value) => Number(value) >= 1024 && Number(value) <= 65535),
  );
  const apiPort = Number(
    await ask('API 端口', 3001, (value) => Number(value) >= 1024 && Number(value) <= 65535),
  );
  const databaseMode =
    preset === 'quick'
      ? 'memory'
      : preset === 'standard'
        ? 'prisma'
        : await choose('数据库模式', [
            { value: 'memory', label: '内存预览（零依赖）' },
            { value: 'prisma', label: 'PostgreSQL + Prisma' },
          ]);
  const databaseUrl =
    databaseMode === 'prisma'
      ? await ask(
          'PostgreSQL DATABASE_URL',
          'postgresql://postgres:postgres@localhost:5432/admin_project?schema=public',
        )
      : 'postgresql://postgres:postgres@localhost:5432/template?schema=public';
  const adminPhone = await ask('初始管理员手机号', '13800000000', (value) =>
    /^1\d{10}$/.test(value),
  );
  const adminName = await ask('初始管理员名称', '系统管理员');
  const adminPassword = `Adm!${randomBytes(18).toString('base64url')}`;
  const objectStorage = preset === 'custom' ? await yes('启用对象存储配置能力', true) : true;
  const objectStorageProvider = objectStorage
    ? await choose('默认对象存储平台', [
        { value: 'tencent_cos', label: '腾讯云 COS' },
        { value: 'aliyun_oss', label: '阿里云 OSS' },
        { value: 'aws_s3', label: 'AWS S3' },
        { value: 's3_compatible', label: 'S3 兼容存储' },
      ])
    : 'none';
  const modules =
    preset === 'custom'
      ? {
          ...presetModules('quick'),
          objectStorage,
          redis: await yes('启用 Redis 配置能力', false),
          sms: await yes('启用短信配置能力', false),
          email: await yes('启用邮件配置能力', false),
          payment: await yes('启用支付配置能力', false),
        }
      : presetModules(preset);
  const config = {
    $schema: './project.config.schema.json',
    schemaVersion: 1,
    template: {
      name: 'adminback-template',
      version: '0.1.0',
      repository: 'https://cnb.cool/nsmiling.com/ai-template',
    },
    project: { name, packageScope, displayName, description },
    runtime: { packageManager: 'pnpm', adminPort, apiPort, deployment: 'local' },
    database: {
      mode: databaseMode,
      engine: databaseMode === 'prisma' ? 'postgresql' : 'none',
      orm: databaseMode === 'prisma' ? 'prisma' : 'none',
    },
    modules,
    providers: { objectStorage: objectStorageProvider },
  };
  const configErrors = validateProjectConfig(config);
  if (configErrors.length) throw new Error(`项目配置无效：${configErrors.join('；')}`);
  const env = [
    'NODE_ENV=development',
    `ADMIN_PORT=${adminPort}`,
    `API_PORT=${apiPort}`,
    'WEB_PORT=3002',
    `DATABASE_URL=${databaseUrl}`,
    `DATA_SOURCE=${databaseMode === 'prisma' ? 'prisma' : 'memory'}`,
    `PUBLIC_API_BASE_URL=http://localhost:${apiPort}/api`,
    `ADMIN_ORIGIN=http://localhost:${adminPort}`,
    'WEB_ORIGIN=http://localhost:3002',
    `JWT_ACCESS_SECRET=${secret()}`,
    `JWT_REFRESH_SECRET=${secret()}`,
    `CONFIG_ENCRYPTION_KEY=${secret()}`,
    'DEV_ADMIN_EMAIL=admin@example.com',
    `DEV_ADMIN_PHONE=${adminPhone}`,
    `DEV_ADMIN_NAME=${adminName}`,
    `DEV_ADMIN_PASSWORD=${adminPassword}`,
    '',
  ].join('\n');
  console.log('\n初始化摘要');
  console.log(JSON.stringify(config, null, 2));
  if (dryRun) console.log('\n[DRY RUN] 未写入任何文件。');
  else {
    try {
      await access(new URL('.env', root), constants.F_OK);
      await copyFile(new URL('.env', root), new URL(`.env.backup-${Date.now()}`, root));
      console.log('[BACKUP] 已备份现有 .env');
    } catch {}
    await writeFile(
      new URL('project.config.json', root),
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );
    await writeFile(new URL('.env', root), env, 'utf8');
    await writeFile(new URL('docs/ai/PROJECT.md', root), renderProjectContext(config), 'utf8');
    await writeFile(
      new URL('apps/admin/src/generated/project.ts', root),
      renderRuntimeProject(config),
      'utf8',
    );
    await writeFile(
      new URL('apps/api/src/generated/project.ts', root),
      renderRuntimeProject(config),
      'utf8',
    );
    await replaceWorkspaceScope(packageScope);
    await formatWorkspaceIfAvailable();
    console.log('\n[DONE] 已生成 project.config.json、.env 与 docs/ai/PROJECT.md');
    console.log('初始管理员密码已随机生成并仅写入 .env 的 DEV_ADMIN_PASSWORD，请首次登录后修改。');
    console.log(
      `下一步：重新运行 pnpm install 刷新工作区链接，再运行 pnpm template:doctor${databaseMode === 'prisma' ? '，确认后运行 pnpm template:provision' : ''}，最后 pnpm dev:local`,
    );
  }
} finally {
  rl?.close();
}
