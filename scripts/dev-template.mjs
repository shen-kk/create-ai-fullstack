import { spawn } from 'node:child_process';
import process from 'node:process';

const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error('请通过 pnpm dev:template 启动模板开发环境');

const child = spawn(process.execPath, [pnpmEntry, 'dev:local'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ENV_FILE: '.env.template-dev',
  },
});

child.on('exit', (code) => process.exit(code ?? 1));
