#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (args.includes('--help') || args.includes('-h')) {
  console.log(`${packageJson.name} ${packageJson.version}

用法：
  npm create aiforge@latest <project-name>

选项：
  --preset=quick|standard|custom  预选初始化模式
  --user-web                     自动启用用户端
  --ref=<git-ref>                指定模板 Tag、分支或 Commit
  --repo=<git-url>               指定模板仓库（模板维护使用）
  -h, --help                     显示帮助
  -v, --version                  显示版本`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(packageJson.version);
  process.exit(0);
}
const positional = args.filter((item) => !item.startsWith('--'));
const destination = resolve(positional[0] || 'my-ai-project');
const projectName = basename(destination);
const repo =
  args.find((item) => item.startsWith('--repo='))?.slice(7) ||
  'https://github.com/shen-kk/create-ai-fullstack.git';
const ref = args.find((item) => item.startsWith('--ref='))?.slice(6) || 'main';

if (existsSync(destination)) {
  console.error(`[ERROR] 目标目录已存在：${destination}`);
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]{1,62}$/.test(projectName)) {
  console.error('[ERROR] 项目目录名只能使用小写字母、数字和连字符，并以字母开头。');
  process.exit(1);
}
const run = (step, command, commandArgs, options = {}) => {
  console.log(`[STEP] ${step}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    console.error(`[ERROR] ${step}无法启动：${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[ERROR] ${step}失败，退出码：${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
};

run('检查 pnpm', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version']);
console.log(`[CREATE] 从 ${repo} (${ref}) 获取模板`);
run('获取模板', 'git', ['clone', '--branch', ref, '--single-branch', repo, destination]);
run('安装模板依赖', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], {
  cwd: destination,
});
const forwardedInitArgs = args.filter(
  (item) => item === '--defaults' || item === '--user-web' || item.startsWith('--preset='),
);
run(
  '初始化项目配置',
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['template:init', '--', `--name=${projectName}`, ...forwardedInitArgs],
  { cwd: destination },
);
run('刷新项目依赖', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], {
  cwd: destination,
});
run(
  '检查项目完整性',
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['template:doctor'],
  { cwd: destination },
);

rmSync(join(destination, '.git'), { recursive: true, force: true });
run('初始化项目 Git 仓库', 'git', ['init'], { cwd: destination });
console.log(`\n[DONE] 项目已创建：${destination}`);
console.log('下一步：进入项目目录并运行 pnpm dev:local');
