#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import * as prompts from '@clack/prompts';
import { featureCatalog, resolveFeatures } from '../lib/features.mjs';

const args = process.argv.slice(2);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (args.includes('--help') || args.includes('-h')) {
  console.log(`${packageJson.name} ${packageJson.version}

用法：
  npm create aiforge@latest <project-name>

选项：
  --features=<id,id>  非交互选择业务功能
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
const repo =
  args.find((item) => item.startsWith('--repo='))?.slice(7) ||
  'https://github.com/shen-kk/create-ai-fullstack.git';
const ref = args.find((item) => item.startsWith('--ref='))?.slice(6) || 'main';
const defaultsMode = args.includes('--defaults');
const featureOption = args.find((item) => item.startsWith('--features='));
const featureArgument = featureOption?.slice(11);
const defaultFeatures = ['customerWeb', 'customerAvatar'];

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
        placeholder: projectName,
        defaultValue: projectName,
        validate: (value) =>
          value.trim().length >= 2 && value.trim().length <= 80 ? undefined : '请输入 2–80 个字符',
      }),
    );
const packageScope = defaultsMode
  ? `@${projectName}`
  : stopIfCancelled(
      await prompts.text({
        message: '包命名空间',
        placeholder: `@${projectName}`,
        defaultValue: `@${projectName}`,
        validate: (value) =>
          /^@[a-z][a-z0-9-]{1,62}$/.test(value) ? undefined : '格式示例：@my-project',
      }),
    );
const selected =
  featureOption !== undefined
    ? featureArgument.split(',').filter(Boolean)
    : defaultsMode
      ? defaultFeatures
      : stopIfCancelled(
          await prompts.multiselect({
            message: '选择项目业务功能（空格选择，回车确认）',
            options: featureCatalog.map((feature) => ({
              value: feature.id,
              label: `${feature.group} · ${feature.label}`,
              hint: feature.hint,
            })),
            initialValues: defaultFeatures,
            required: false,
          }),
        );
const resolvedFeatures = resolveFeatures(selected);
const confirmed = defaultsMode
  ? true
  : stopIfCancelled(
      await prompts.confirm({
        message: `将生成 ${resolvedFeatures.length || '仅核心'} 项功能，确认创建？`,
        initialValue: true,
      }),
    );
if (!confirmed) {
  prompts.cancel('已取消创建项目。');
  process.exit(0);
}

try {
  run('检查 pnpm', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version']);
  run('获取模板源码', 'git', ['clone', '--branch', ref, '--single-branch', repo, destination]);
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
  run('检查项目结构', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['feature:check'], {
    cwd: destination,
  });
  rmSync(join(destination, '.git'), { recursive: true, force: true });
  run('初始化项目 Git 仓库', 'git', ['init'], { cwd: destination });
  prompts.outro(`项目已创建：${destination}\n下一步：cd ${projectName} && pnpm run setup`);
} catch (error) {
  prompts.cancel(error instanceof Error ? error.message : '创建项目失败');
  process.exitCode = 1;
}
