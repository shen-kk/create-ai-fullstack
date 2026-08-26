import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { enabledPackages } from './lib/enabled-tasks.mjs';
import { parseEnv } from './lib/template-config.mjs';

const task = process.argv[2];
if (!['dev', 'build', 'lint', 'typecheck', 'test'].includes(task)) {
  console.error('用法：node scripts/run-enabled.mjs <dev|build|lint|typecheck|test>');
  process.exit(1);
}
const config = JSON.parse(
  await readFile(new URL('../project.config.json', import.meta.url), 'utf8'),
);
const requestedPackage = process.argv[3];
const enabled = enabledPackages(config, task);
const packageName = requestedPackage
  ? `${config.project.packageScope}/${requestedPackage}`
  : undefined;
if (packageName && !enabled.includes(packageName)) {
  console.error(`应用 ${requestedPackage} 未在 project.config.json 中启用`);
  process.exit(1);
}
const packages = packageName ? [packageName] : enabled;
const filters = packages.flatMap((name) => [`--filter=${name}`]);
const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error('必须通过 pnpm 脚本运行能力调度器');
let localEnv = {};
try {
  localEnv = parseEnv(await readFile(resolve(process.cwd(), '.env'), 'utf8'));
} catch {}
const child = spawn(process.execPath, [pnpmEntry, 'exec', 'turbo', task, ...filters], {
  stdio: 'inherit',
  env: { ...process.env, ...localEnv },
});
child.on('exit', (code) => process.exit(code ?? 1));
