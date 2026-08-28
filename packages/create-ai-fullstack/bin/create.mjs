#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import * as prompts from '@clack/prompts';
import { resolveFeatures } from '../lib/features.mjs';

const args = process.argv.slice(2);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (args.includes('--help') || args.includes('-h')) {
  console.log(`${packageJson.name} ${packageJson.version}

用法：
  npm create aiforge@latest <project-name>

选项：
  --features=customerWeb  非交互启用用户端；传空值则关闭
  --defaults          使用默认功能组合
  --ref=<git-ref>     指定模板 Tag、分支或 Commit
  --repo=<git-url>    指定模板仓库（模板维护使用）
  -h, --help          显示帮助
  -v, --version       显示版本`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(packageJson.version);
  process.exit(0);
}

const positional = args.filter((item) => !item.startsWith('--'));
const destination = resolve(positional[0] || 'my-ai-project');
const projectName = basename(destination);
const explicitRepo = args.find((item) => item.startsWith('--repo='))?.slice(7);
const repository = explicitRepo || 'https://github.com/shen-kk/create-ai-fullstack.git';
const ref = args.find((item) => item.startsWith('--ref='))?.slice(6) || 'main';
const defaultsMode = args.includes('--defaults');
const featureOption = args.find((item) => item.startsWith('--features='));
const featureArgument = featureOption?.slice(11);

const stopIfCancelled = (value) => {
  if (prompts.isCancel(value)) {
    prompts.cancel('已取消创建项目。');
    process.exit(0);
  }
  return value;
};
const run = (step, command, commandArgs, options = {}) => {
  const spinner = prompts.spinner();
  spinner.start(step);
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0 || result.error) {
    spinner.stop(`${step}失败`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw result.error ?? new Error(`${step}失败，退出码：${result.status ?? 1}`);
  }
  spinner.stop(`${step}完成`);
};
const cloneTemplate = () => {
  const spinner = prompts.spinner();
  spinner.start('获取模板源码');
  const result = spawnSync(
    'git',
    ['clone', '--branch', ref, '--single-branch', repository, destination],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (result.status === 0 && !result.error) {
    spinner.stop('获取模板源码完成');
    return;
  }
  const reason = result.error?.message || result.stderr?.trim() || `退出码 ${result.status ?? 1}`;
  rmSync(destination, { recursive: true, force: true });
  spinner.stop('获取模板源码失败');
  throw new Error(`无法从 GitHub 获取模板源码（${repository}，ref: ${ref}）：\n${reason}`);
};

if (existsSync(destination)) {
  console.error(`[ERROR] 目标目录已存在：${destination}`);
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]{1,62}$/.test(projectName)) {
  console.error('[ERROR] 项目目录名只能使用小写字母、数字和连字符，并以字母开头。');
  process.exit(1);
}

prompts.intro('AIForge 项目创建向导');
const displayName = defaultsMode
  ? projectName
  : stopIfCancelled(
      await prompts.text({
        message: '项目显示名称',
        initialValue: projectName,
        validate: (value) =>
          value.trim().length >= 2 && value.trim().length <= 80
            ? undefined
            : `建议使用默认名称 ${projectName}，或输入 2–80 个字符`,
      }),
    );
const packageScope = defaultsMode
  ? `@${projectName}`
  : stopIfCancelled(
      await prompts.text({
        message: '包命名空间',
        initialValue: `@${projectName}`,
        validate: (value) =>
          /^@[a-z][a-z0-9-]{1,62}$/.test(value) ? undefined : '格式示例：@my-project',
      }),
    );
const selected =
  featureOption !== undefined
    ? featureArgument.split(',').filter(Boolean)
    : defaultsMode
      ? ['customerWeb']
      : stopIfCancelled(
            await prompts.confirm({
              message: '是否启用用户端？',
              initialValue: true,
            }),
          )
        ? ['customerWeb']
        : [];
const resolvedFeatures = resolveFeatures(selected);
const confirmed = defaultsMode
  ? true
  : stopIfCancelled(
      await prompts.confirm({
        message: `将生成${resolvedFeatures.includes('customerWeb') ? '包含用户端的' : '仅后台与 API 的'}项目，确认创建？`,
        initialValue: true,
      }),
    );
if (!confirmed) {
  prompts.cancel('已取消创建项目。');
  process.exit(0);
}

try {
  run('检查 pnpm', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version']);
  cloneTemplate();
  run(
    '组合所选功能',
    process.execPath,
    [
      join(destination, 'scripts', 'template-init.mjs'),
      `--name=${projectName}`,
      `--display-name=${String(displayName)}`,
      `--scope=${String(packageScope)}`,
      `--features=${resolvedFeatures.join(',')}`,
    ],
    { cwd: destination, shell: false },
  );
  run('安装项目依赖', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], {
    cwd: destination,
  });
  run('格式化项目源码', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['run', 'format'], {
    cwd: destination,
  });
  run(
    '检查项目结构',
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['run', 'feature:check'],
    {
      cwd: destination,
    },
  );
  rmSync(join(destination, '.git'), { recursive: true, force: true });
  run('初始化项目 Git 仓库', 'git', ['init'], { cwd: destination });
  prompts.outro(`项目已创建：${destination}\n下一步：cd ${projectName} && pnpm run setup`);
} catch (error) {
  prompts.cancel(error instanceof Error ? error.message : '创建项目失败');
  process.exitCode = 1;
}
