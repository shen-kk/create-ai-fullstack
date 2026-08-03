import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const source = decodeURIComponent(
  new URL('../', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''),
).replace(/[\\/]$/, '');
const target = await mkdtemp(join(tmpdir(), 'adminback-template-verify-'));
const keep = process.argv.includes('--keep');
const full = process.argv.includes('--full');
const excluded = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  '.turbo',
  'dist',
  '.output',
  '.nuxt',
  'coverage',
]);
const filter = (path) => {
  const relative = path.slice(source.length).replace(/^[/\\]/, '');
  const segments = relative.split(/[/\\]/).filter(Boolean);
  if (segments.some((segment) => excluded.has(segment))) return false;
  const name = segments.at(-1) ?? '';
  if (name === '.env' || name.startsWith('.env.backup-') || name.endsWith('.log')) return false;
  return true;
};
const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [join(target, 'scripts', script), ...args], {
    cwd: target,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0)
    throw new Error(`${script} 执行失败，退出码 ${result.status ?? 'unknown'}`);
};
const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: target,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    shell: false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} 执行失败，退出码 ${result.status ?? 'unknown'}`);
};

try {
  console.log(`[COPY] 创建干净副本：${target}`);
  await cp(source, target, { recursive: true, filter });
  const pnpmEntry = process.env.npm_execpath;
  const pnpm = pnpmEntry ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const pnpmArgs = (args) => (pnpmEntry ? [pnpmEntry, ...args] : args);
  if (full) {
    console.log('[FULL] 在初始化前安装锁定依赖，模拟文档推荐的新项目流程。');
    runCommand(pnpm, pnpmArgs(['install', '--frozen-lockfile']));
  }
  run('template-init.mjs', ['--defaults', '--preset=quick', '--user-web']);
  run('template-doctor.mjs');
  const config = await readFile(join(target, 'project.config.json'), 'utf8');
  const context = await readFile(join(target, 'docs', 'ai', 'PROJECT.md'), 'utf8');
  const contractsPackage = JSON.parse(
    await readFile(join(target, 'packages', 'contracts', 'package.json'), 'utf8'),
  );
  const forbidden = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CONFIG_ENCRYPTION_KEY',
    'DATABASE_URL',
    'DEV_ADMIN_PASSWORD',
  ];
  if (forbidden.some((key) => config.includes(key) || context.includes(key)))
    throw new Error('项目声明或 AI 记忆包含敏感字段');
  if (contractsPackage.name !== '@admin-project/contracts')
    throw new Error(`包命名空间未替换：${contractsPackage.name}`);
  const initialized = JSON.parse(config);
  if (!initialized.modules.userWeb || !initialized.modules.customerAuthentication)
    throw new Error('用户端能力未按验收参数启用');
  console.log('[PASS] 全新目录初始化、配置检查和敏感信息隔离验证通过。');
  if (full) {
    console.log('[FULL] 刷新新命名空间的工作区链接。');
    runCommand(pnpm, pnpmArgs(['install', '--frozen-lockfile']));
    console.log('[FULL] 生成 Prisma Client。');
    runCommand(pnpm, pnpmArgs(['db:generate']));
    console.log('[FULL] 执行初始化后的后台/API 全量质量门禁。');
    runCommand(pnpm, pnpmArgs(['check']));
    console.log('[PASS] 全新目录依赖安装、测试与生产构建验证通过。');
  }
} catch (error) {
  console.error(`[FAIL] 全新目录验收失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
} finally {
  if (keep) console.log(`[KEEP] 验收目录已保留：${target}`);
  else {
    await rm(target, { recursive: true, force: true });
    console.log('[CLEAN] 临时验收目录已清理。');
  }
}
