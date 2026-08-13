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
import { checkRedisConnection } from './lib/infrastructure-checks.mjs';

const root = new URL('../', import.meta.url);
const args = new Set(process.argv.slice(2));
const defaultsMode = args.has('--defaults');
const userWebMode = args.has('--user-web');
const dryRun = args.has('--dry-run');
const presetArgument = process.argv
  .slice(2)
  .find((item) => item.startsWith('--preset='))
  ?.split('=')[1];
const projectNameArgument = process.argv
  .slice(2)
  .find((item) => item.startsWith('--name='))
  ?.slice(7);
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
const optional = async (label) => (await ask(label, '')).trim();
const askRequired = (label, fallback = '') =>
  ask(label, fallback, (value) => value.trim().length > 0);
const portValidator = (value) => Number(value) >= 1024 && Number(value) <= 65535;
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
const integration = (kind, enabled, values, secrets = {}) => ({ kind, enabled, values, secrets });
const collectIntegrationBootstrap = async (modules, objectStorageProvider, database) => {
  const items = [];
  if (database.mode === 'prisma')
    items.push(
      integration(
        'sql',
        true,
        {
          engine: 'postgresql',
          host: database.host,
          port: String(database.port),
          database: database.name,
          username: database.username,
        },
        { password: database.password },
      ),
    );
  if (modules.redis && (await yes('现在填写并校验 Redis 配置', false))) {
    while (true) {
      const provider = await choose('Redis 部署平台', [
        { value: 'self_hosted', label: '自建 Redis' },
        { value: 'tencent_redis', label: '腾讯云 Redis' },
        { value: 'aliyun_redis', label: '阿里云 Redis' },
      ]);
      const redisTarget = new URL(await ask('Redis URL', 'redis://127.0.0.1:6379'));
      const urlPassword = decodeURIComponent(redisTarget.password);
      redisTarget.password = '';
      const redis = integration(
        'redis',
        true,
        { provider, url: redisTarget.toString() },
        { password: (await optional('Redis 密码（无密码直接回车）')) || urlPassword },
      );
      try {
        console.log('[CHECK] 正在校验 Redis 连接与鉴权。');
        await checkRedisConnection(redis);
        console.log('[PASS] Redis 连接与鉴权通过。');
        items.push(redis);
        break;
      } catch (error) {
        console.log(
          `[RETRY] Redis 配置无效：${error instanceof Error ? error.message : '连接失败'}`,
        );
        if (!(await yes('重新填写 Redis 配置', true))) break;
      }
    }
  }
  if (modules.objectStorage && (await yes('现在填写对象存储配置', false)))
    items.push(
      integration(
        'object_storage',
        true,
        {
          provider: objectStorageProvider,
          endpoint: await optional('对象存储 Endpoint（腾讯云 COS 可留空）'),
          bucket: await ask('Bucket', 'example-1250000000'),
          region: await ask('区域', 'ap-guangzhou'),
          accessKeyId: await askRequired('Access Key ID / SecretId'),
        },
        { secretAccessKey: await askRequired('Access Key Secret / SecretKey') },
      ),
    );
  if (modules.sms && (await yes('现在填写短信服务配置', false))) {
    const provider = await choose('短信服务商', [
      { value: 'tencent_sms', label: '腾讯云短信' },
      { value: 'aliyun_sms', label: '阿里云短信' },
    ]);
    items.push(
      integration(
        'sms',
        true,
        {
          provider,
          region: await ask('区域', 'ap-guangzhou'),
          accessKeyId: await askRequired('Access Key ID / SecretId'),
          signName: await askRequired('短信签名'),
          appId: await askRequired('短信应用 SDK AppID'),
          templateId: await askRequired('验证码模板 ID'),
        },
        { accessKeySecret: await askRequired('Access Key Secret / SecretKey') },
      ),
    );
  }
  if (modules.email && (await yes('现在填写 SMTP 邮件配置', false)))
    items.push(
      integration(
        'email',
        true,
        {
          provider: 'smtp',
          host: await ask('SMTP 主机', 'smtp.example.com'),
          port: await ask('SMTP 端口', '465'),
          username: await askRequired('SMTP 用户名'),
          from: await askRequired('发件地址'),
          secure: (await yes('使用 SSL/TLS', true)) ? 'true' : 'false',
        },
        { password: await askRequired('SMTP 密码/授权码') },
      ),
    );
  if (modules.payment && (await yes('现在填写支付配置', false))) {
    const provider = await choose('支付渠道', [
      { value: 'wechat_pay', label: '微信支付' },
      { value: 'alipay', label: '支付宝' },
      { value: 'stripe', label: 'Stripe' },
    ]);
    items.push(
      integration(
        'payment',
        true,
        { provider, merchantId: await askRequired('商户号') },
        {
          apiKey: await askRequired('API Key'),
          privateKey: await askRequired('私钥'),
          webhookSecret: await askRequired('回调密钥'),
        },
      ),
    );
  }
  const required = {
    sql: ['engine', 'host', 'port', 'database', 'username', 'password'],
    redis: ['provider', 'url'],
    object_storage: ['provider', 'bucket', 'region', 'accessKeyId', 'secretAccessKey'],
    sms: [
      'provider',
      'region',
      'accessKeyId',
      'accessKeySecret',
      'signName',
      'appId',
      'templateId',
    ],
    email: ['provider', 'host', 'port', 'username', 'password', 'from'],
    payment: ['provider', 'merchantId', 'apiKey', 'privateKey', 'webhookSecret'],
  };
  for (const item of items)
    for (const key of required[item.kind] ?? [])
      if (!(item.values[key] ?? item.secrets[key] ?? '').trim())
        throw new Error(`${item.kind}.${key} 为必填配置，请重新运行初始化向导`);
  return items;
};
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
  const allowed = /\.(?:ts|vue|json|html|mjs|yaml|yml|md)$/;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'dist', '.nuxt', '.output'].includes(entry.name)) continue;
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) await visit(url);
      else if (allowed.test(entry.name)) {
        const source = await readFile(url, 'utf8');
        if (source.includes(`${currentScope}/`))
          await writeFile(url, source.replaceAll(`${currentScope}/`, `${nextScope}/`), 'utf8');
      }
    }
  };
  await visit(root);
  console.log(`[RENAME] 工作区包命名空间 ${currentScope} → ${nextScope}`);
};

try {
  console.log('\nAdminback 模板初始化\n敏感信息只写入本机 .env，不会写入 project.config.json。\n');
  const preset =
    presetArgument ??
    (await choose(
      '初始化模式',
      [
        { value: 'quick', label: '快速：PostgreSQL 基础配置，最少外部依赖' },
        { value: 'standard', label: '标准：PostgreSQL、Redis、对象存储和邮件能力' },
        { value: 'custom', label: '自定义：逐项选择基础能力' },
      ],
      2,
    ));
  if (!['quick', 'standard', 'custom'].includes(preset))
    throw new Error('PRESET_INVALID：仅支持 quick、standard、custom');
  if (projectNameArgument && !/^[a-z][a-z0-9-]{1,62}$/.test(projectNameArgument))
    throw new Error('PROJECT_NAME_INVALID：项目名称只能使用小写字母、数字和连字符');
  const name =
    projectNameArgument ??
    (await ask('项目英文名称', 'admin-project', (value) => /^[a-z][a-z0-9-]{1,62}$/.test(value)));
  const packageScope = await ask('包命名空间', `@${name}`, (value) =>
    /^@[a-z][a-z0-9-]{1,62}$/.test(value),
  );
  const displayName = await ask(
    '项目显示名称',
    '后台管理系统',
    (value) => value.length >= 2 && value.length <= 80,
  );
  const description = await ask('项目简介', '内部运营后台');
  const defaultLocale = await choose('默认界面语言', [{ value: 'zh-CN', label: '简体中文' }]);
  const adminPort = Number(
    await ask('后台端口', 3000, (value) => Number(value) >= 1024 && Number(value) <= 65535),
  );
  const apiPort = Number(
    await ask('API 端口', 3001, (value) => Number(value) >= 1024 && Number(value) <= 65535),
  );
  const webPort = Number(
    preset === 'custom' ? await ask('用户端端口', '3002', portValidator) : '3002',
  );
  const databaseMode = 'prisma';
  const database =
    databaseMode === 'prisma'
      ? {
          mode: 'prisma',
          host: await ask('PostgreSQL 主机', '127.0.0.1'),
          port: Number(await ask('PostgreSQL 端口', '5432', portValidator)),
          name: await ask('PostgreSQL 数据库名', name.replaceAll('-', '_')),
          username: await ask('PostgreSQL 用户名', 'postgres'),
          password: await askRequired('PostgreSQL 密码', defaultsMode ? secret() : ''),
        }
      : null;
  if (!database) throw new Error('DATABASE_CONFIG_REQUIRED：必须提供 PostgreSQL 配置');
  const databaseUrl = `postgresql://${encodeURIComponent(database.username)}:${encodeURIComponent(database.password)}@${database.host}:${database.port}/${encodeURIComponent(database.name)}?schema=public`;
  const adminPhone = await ask('初始管理员手机号', '13800000000', (value) =>
    /^1\d{10}$/.test(value),
  );
  const adminName = await ask('初始管理员名称', '系统管理员');
  const adminPassword = `Adm!${randomBytes(18).toString('base64url')}`;
  const objectStorage = preset === 'custom' ? await yes('启用对象存储配置能力', true) : true;
  const userWeb =
    userWebMode || (await yes('启用用户端（注册、登录、个人中心和后台用户管理）', false));
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
          userWeb,
          customerAuthentication: userWeb,
          objectStorage,
          redis: await yes('启用 Redis 配置能力', false),
          sms: await yes('启用短信配置能力', false),
          email: await yes('启用邮件配置能力', false),
          payment: await yes('启用支付配置能力', false),
          deploymentCenter: await yes('启用部署中心', false),
        }
      : {
          ...presetModules(preset),
          userWeb,
          customerAuthentication: userWeb,
          deploymentCenter: await yes('启用部署中心', false),
        };
  if (userWeb) {
    modules.sms = true;
    modules.redis = true;
  }
  console.log(`\n[CHOICE] 用户端：${userWeb ? '启用' : '不启用'}`);
  const config = {
    $schema: './project.config.schema.json',
    schemaVersion: 1,
    template: {
      name: 'adminback-template',
      version: '0.1.0',
      repository: 'https://github.com/shen-kk/create-ai-fullstack',
    },
    project: { name, packageScope, displayName, description },
    runtime: { packageManager: 'pnpm', adminPort, apiPort, webPort },
    database: {
      mode: databaseMode,
      engine: databaseMode === 'prisma' ? 'postgresql' : 'none',
      orm: databaseMode === 'prisma' ? 'prisma' : 'none',
    },
    localization: { defaultLocale, supportedLocales: [defaultLocale] },
    ui: {
      web: {
        businessComponents: 'shadcn-vue',
        motion: 'vueuse-motion',
        orchestration: 'gsap',
        designStandard: 'apple-linear-vercel',
      },
    },
    modules,
    providers: { objectStorage: objectStorageProvider },
  };
  const configErrors = validateProjectConfig(config);
  if (configErrors.length) throw new Error(`项目配置无效：${configErrors.join('；')}`);
  const bootstrapIntegrations = await collectIntegrationBootstrap(
    modules,
    objectStorageProvider,
    database,
  );
  const provisionNow =
    databaseMode === 'prisma' && !defaultsMode
      ? await yes('配置完成后立即校验连接、初始化数据库并创建管理员', true)
      : false;
  const env = [
    'NODE_ENV=development',
    `ADMIN_PORT=${adminPort}`,
    `API_PORT=${apiPort}`,
    `WEB_PORT=${webPort}`,
    `DATABASE_URL=${databaseUrl}`,
    `PUBLIC_API_BASE_URL=http://localhost:${apiPort}/api`,
    `ADMIN_ORIGIN=http://localhost:${adminPort}`,
    `WEB_ORIGIN=http://localhost:${webPort}`,
    `JWT_ACCESS_SECRET=${secret()}`,
    `JWT_REFRESH_SECRET=${secret()}`,
    `CUSTOMER_JWT_ACCESS_SECRET=${secret()}`,
    `CUSTOMER_JWT_REFRESH_SECRET=${secret()}`,
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
    if (bootstrapIntegrations.length)
      await writeFile(
        new URL('.template-bootstrap.json', root),
        `${JSON.stringify({ integrations: bootstrapIntegrations }, null, 2)}\n`,
        'utf8',
      );
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
    await writeFile(
      new URL('apps/web/app/generated/project.ts', root),
      renderRuntimeProject(config),
      'utf8',
    );
    await replaceWorkspaceScope(packageScope);
    await formatWorkspaceIfAvailable();
    console.log('\n[DONE] 已生成 project.config.json、.env 与 docs/ai/PROJECT.md');
    console.log(`初始管理员手机号：${adminPhone}`);
    console.log(
      '初始管理员随机密码仅保存在项目根目录 .env 的 DEV_ADMIN_PASSWORD，请复制完整值登录并在首次登录后修改。',
    );
    if (provisionNow) {
      const pnpmEntry = process.env.npm_execpath;
      const executable = pnpmEntry
        ? process.execPath
        : process.platform === 'win32'
          ? 'pnpm.cmd'
          : 'pnpm';
      const run = (args) => {
        const commandArgs = pnpmEntry ? [pnpmEntry, ...args] : args;
        const result = spawnSync(executable, commandArgs, {
          cwd: fileURLToPath(root),
          stdio: 'inherit',
          env: process.env,
          shell: false,
        });
        if (result.error) throw result.error;
        if (result.status !== 0)
          throw new Error(`自动初始化失败，退出码 ${result.status ?? 'unknown'}`);
      };
      console.log('\n[SETUP] 刷新工作区链接并校验数据库配置。');
      run(['install', '--frozen-lockfile']);
      run(['template:provision', '--', '--yes']);
    } else
      console.log(
        '下一步：重新运行 pnpm install 刷新工作区链接，再运行 pnpm template:doctor，确认后运行 pnpm template:provision，最后 pnpm dev:local',
      );
  }
} finally {
  rl?.close();
}
