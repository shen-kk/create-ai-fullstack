import { spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { checkRedisConnection } from './lib/infrastructure-checks.mjs';
import { parseEnv, provisionCommands, validateProjectConfig } from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const rootPath = decodeURIComponent(root.pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirmed = args.has('--yes');
const pnpmEntry = process.env.npm_execpath;
const executable = pnpmEntry
  ? process.execPath
  : process.platform === 'win32'
    ? 'pnpm.cmd'
    : 'pnpm';

try {
  const config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
  const errors = validateProjectConfig(config);
  if (errors.length) throw new Error(errors.join('；'));

  const envFile = parseEnv(await readFile(new URL('.env', root), 'utf8'));
  if (!envFile.DATABASE_URL) throw new Error('缺少 DATABASE_URL，请先运行 pnpm run setup');

  const commands = provisionCommands(config);
  if (process.env.SKIP_PRISMA_GENERATE === '1') {
    const index = commands.findIndex((command) => command.includes('db:generate'));
    if (index >= 0) commands.splice(index, 1);
  }

  console.log('将执行：生成 Prisma Client → 部署已有迁移 → 创建或更新初始管理员。');
  console.log('目标数据库来自 .env，连接串不会显示；该操作会写入目标数据库。');
  if (dryRun) {
    for (const command of commands) console.log(`[DRY RUN] pnpm ${command.join(' ')}`);
    process.exit(0);
  }

  if (!confirmed) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('确认继续？输入 YES：')).trim();
    rl.close();
    if (answer !== 'YES') {
      console.log('[CANCELLED] 未修改数据库。');
      process.exit(0);
    }
  }

  const childEnv = { ...process.env, ...envFile };
  const bootstrapUrl = new URL('.template-bootstrap.json', root);
  try {
    const bootstrap = JSON.parse(await readFile(bootstrapUrl, 'utf8'));
    childEnv.TEMPLATE_BOOTSTRAP_FILE = decodeURIComponent(
      bootstrapUrl.pathname.replace(/^\/(?=[A-Za-z]:)/, ''),
    );
    const redis = bootstrap.integrations?.find((item) => item.kind === 'redis' && item.enabled);
    if (redis) {
      console.log('[CHECK] 正在校验 Redis 连接与鉴权。');
      await checkRedisConnection(redis);
      console.log('[PASS] Redis 连接与鉴权通过。');
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }

  for (const command of commands) {
    console.log(`[RUN] pnpm ${command.join(' ')}`);
    const commandArgs = pnpmEntry ? [pnpmEntry, ...command] : command;
    const result = spawnSync(executable, commandArgs, {
      cwd: rootPath,
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`命令执行失败，退出码 ${result.status ?? 'unknown'}`);
  }

  if (childEnv.TEMPLATE_BOOTSTRAP_FILE) {
    await rm(bootstrapUrl, { force: true });
    console.log('[CLEAN] 服务密钥已加密写入数据库，一次性引导文件已删除。');
  }
  console.log('[DONE] 数据库迁移与初始管理员创建完成。');
} catch (error) {
  console.error(`[FAIL] 数据库部署失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
}
