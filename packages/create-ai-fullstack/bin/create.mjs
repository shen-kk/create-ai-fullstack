#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (args.includes('--help') || args.includes('-h')) {
  console.log(`${packageJson.name} ${packageJson.version}

用法：
  npm create aiforge@latest <project-name>

选项：
  --preset=quick|standard|custom  预选初始化模式
  --user-web                     自动启用用户端
  --deployment-center            自动启用部署中心
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

const defaultsMode = args.includes('--defaults');
const input = defaultsMode ? undefined : createInterface({ input: process.stdin, output: process.stdout });
const ask = async (label, fallback, validate = () => true) => {
  if (!input) return String(fallback);
  while (true) {
    const value = (await input.question(`${label} (${fallback}): `)).trim() || String(fallback);
    if (validate(value)) return value;
    console.log('输入格式不正确，请重新输入。');
  }
};
const choose = async (label, options, fallbackIndex = 0) => {
  if (input) {
    console.log(`\n${label}`);
    options.forEach((item, index) => console.log(`  ${index + 1}. ${item.label}`));
  }
  const answer = Number(await ask('请选择序号', fallbackIndex + 1, (value) => Number(value) >= 1 && Number(value) <= options.length));
  return options[answer - 1].value;
};
const yes = async (label, fallback = false) => ['y', 'yes', '是'].includes((await ask(`${label} [${fallback ? 'Y/n' : 'y/N'}]`, fallback ? 'y' : 'n')).toLowerCase());

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

console.log('\nAIFORGE 项目创建向导\n请先选择项目能力，确认后才会下载模板。');
const preset = args.find((item) => item.startsWith('--preset='))?.slice(9) || await choose('初始化模式', [
  { value: 'quick', label: '快速：PostgreSQL 基础配置，最少外部依赖' },
  { value: 'standard', label: '标准：PostgreSQL、Redis、对象存储和邮件能力' },
  { value: 'custom', label: '自定义：逐项选择基础能力' },
], 2);
const enableUserWeb = args.includes('--user-web') || await yes('启用用户端', false);
const enableDeploymentCenter = args.includes('--deployment-center') || await yes('启用部署中心', false);
input?.close();
console.log(`\n[CHOICE] 模式：${preset}；用户端：${enableUserWeb ? '启用' : '不启用'}；部署中心：${enableDeploymentCenter ? '启用' : '不启用'}`);

run('检查 pnpm', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version']);
console.log(`[CREATE] 从 ${repo} (${ref}) 获取模板`);
run('获取模板', 'git', ['clone', '--branch', ref, '--single-branch', repo, destination]);
run('安装模板依赖', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], {
  cwd: destination,
});
const forwardedInitArgs = [
  ...(defaultsMode ? ['--defaults'] : []),
  `--preset=${preset}`,
  ...(enableUserWeb ? ['--user-web'] : []),
  ...(enableDeploymentCenter ? ['--deployment-center'] : []),
];
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
