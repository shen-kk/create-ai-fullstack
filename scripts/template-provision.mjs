import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { parseEnv, provisionCommands, validateProjectConfig } from './lib/template-config.mjs';

const root = new URL('../', import.meta.url),
  rootPath = decodeURIComponent(root.pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const args = new Set(process.argv.slice(2)),
  dryRun = args.has('--dry-run'),
  confirmed = args.has('--yes');
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

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
  for (const command of commands) {
    console.log(`[RUN] pnpm ${command.join(' ')}`);
    const result = spawnSync(executable, command, {
      cwd: rootPath,
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`命令执行失败，退出码 ${result.status ?? 'unknown'}`);
  }
  console.log('[DONE] 数据库迁移与初始管理员创建完成。');
} catch (error) {
  console.error(`[FAIL] 数据库部署失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
}
