import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { enabledPackages } from './lib/enabled-tasks.mjs';

const task = process.argv[2];
if (!['dev', 'build', 'lint', 'typecheck', 'test'].includes(task)) {
  console.error('用法：node scripts/run-enabled.mjs <dev|build|lint|typecheck|test>');
  process.exit(1);
}
const config = JSON.parse(
  await readFile(new URL('../project.config.json', import.meta.url), 'utf8'),
);
const packages = enabledPackages(config, task);
const filters = packages.flatMap((name) => [`--filter=${name}`]);
const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error('必须通过 pnpm 脚本运行能力调度器');
const child = spawn(process.execPath, [pnpmEntry, 'exec', 'turbo', task, ...filters], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
