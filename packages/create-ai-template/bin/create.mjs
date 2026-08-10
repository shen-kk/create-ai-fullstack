#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const positional = args.filter((item) => !item.startsWith('--'));
const destination = resolve(positional[0] || 'my-ai-project');
const repo = args.find((item) => item.startsWith('--repo='))?.slice(7) || 'https://cnb.cool/nsmiling.com/ai-template';
const ref = args.find((item) => item.startsWith('--ref='))?.slice(6) || 'main';

if (existsSync(destination)) {
  console.error(`[ERROR] 目标目录已存在：${destination}`);
  process.exit(1);
}
const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`[CREATE] 从 ${repo} (${ref}) 获取模板`);
run('git', ['clone', '--branch', ref, '--single-branch', repo, destination]);
run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], { cwd: destination });
run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['template:init'], { cwd: destination });
console.log('\n[DONE] 项目已创建。请继续运行 pnpm template:doctor。');
