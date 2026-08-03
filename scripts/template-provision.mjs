import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';
import process from 'node:process';
import { parseEnv, provisionCommands, validateProjectConfig } from './lib/template-config.mjs';

const root = new URL('../', import.meta.url),
  rootPath = decodeURIComponent(root.pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const args = new Set(process.argv.slice(2)),
  dryRun = args.has('--dry-run'),
  confirmed = args.has('--yes');
const pnpmEntry = process.env.npm_execpath;
const executable = pnpmEntry
  ? process.execPath
  : process.platform === 'win32'
    ? 'pnpm.cmd'
    : 'pnpm';

const checkRedis = async (item) => {
  const target = new URL(item.values.url);
  if (!['redis:', 'rediss:'].includes(target.protocol))
    throw new Error('Redis URL 必须使用 redis:// 或 rediss://');
  await new Promise((resolve, reject) => {
    const socket =
      target.protocol === 'rediss:'
        ? connectTls({ host: target.hostname, port: Number(target.port || 6380) })
        : connectTcp({ host: target.hostname, port: Number(target.port || 6379) });
    const timer = setTimeout(() => socket.destroy(new Error('Redis 连接超时')), 5000);
    let response = '';
    socket.setEncoding('utf8');
    socket.once('error', reject);
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.includes('+PONG')) {
        clearTimeout(timer);
        socket.end();
        resolve();
      } else if (response.includes('-ERR') || response.includes('-WRONGPASS')) {
        clearTimeout(timer);
        socket.destroy();
        reject(new Error('Redis 鉴权失败'));
      }
    });
    socket.once('connect', () => {
      const password = item.secrets.password || decodeURIComponent(target.password);
      const username = decodeURIComponent(target.username);
      const commands = [];
      if (password) {
        const parts = username ? ['AUTH', username, password] : ['AUTH', password];
        commands.push(
          `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`,
        );
      }
      commands.push('*1\r\n$4\r\nPING\r\n');
      socket.write(commands.join(''));
    });
  });
};

try {
  const config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
  const errors = validateProjectConfig(config);
  if (errors.length) throw new Error(errors.join('；'));
  const commands = provisionCommands(config);
  if (!commands.length) {
    console.log('[SKIP] 当前为内存模式，不需要数据库部署。');
    process.exit(0);
  }
  const envFile = parseEnv(await readFile(new URL('.env', root), 'utf8'));
  if (!envFile.DATABASE_URL) throw new Error('缺少 DATABASE_URL，请先运行 pnpm template:init');
  console.log('将执行：生成 Prisma Client → 部署已有迁移 → 创建或更新初始管理员。');
  console.log('目标数据库来自 .env，连接串不会显示。此操作会写入该数据库。');
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
      await checkRedis(redis);
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
