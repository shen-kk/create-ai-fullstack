import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('CLI and diagnostics use pnpm run setup instead of the pnpm built-in command', async () => {
  const executableSources = await Promise.all([
    read('packages/create-ai-fullstack/bin/create.mjs'),
    read('scripts/template-doctor.mjs'),
    read('scripts/template-provision.mjs'),
  ]);
  const userGuides = await Promise.all([read('README.md'), read('docs/GETTING_STARTED.md')]);

  for (const source of executableSources) {
    assert.match(source, /pnpm run setup/);
    assert.doesNotMatch(source, /pnpm setup/);
  }
  for (const source of userGuides) assert.match(source, /pnpm run setup/);
});

test('CLI only asks about the customer app and only pulls the official GitHub template', async () => {
  const source = await read('packages/create-ai-fullstack/bin/create.mjs');
  assert.match(source, /是否启用用户端/);
  assert.doesNotMatch(source, /prompts\.multiselect/);
  assert.match(source, /initialValue: projectName/);
  assert.doesNotMatch(source, /defaultValue: projectName/);
  assert.match(source, /建议使用默认名称/);
  assert.match(source, /github\.com\/shen-kk\/create-ai-fullstack/);
  assert.doesNotMatch(source, /cnb\.cool/);
  assert.match(source, /无法从 GitHub 获取模板源码/);
  assert.match(source, /featureArgument\.split\(','\)\.filter\(Boolean\)/);
});

test('setup writes the collected local environment without a redundant final confirmation', async () => {
  const source = await read('scripts/project-setup.mjs');

  assert.doesNotMatch(source, /确认写入本地环境配置/);
  assert.match(source, /await writeFile\(new URL\('\.env', root\), env, 'utf8'\)/);
});

test('setup always invokes database provisioning as an explicit pnpm script', async () => {
  const setup = await read('scripts/project-setup.mjs');
  const provision = await read('scripts/template-provision.mjs');

  assert.match(setup, /\['run', 'template:provision', '--', '--yes'\]/);
  assert.match(setup, /includes\('pnpm'\)/);
  assert.match(provision, /includes\('pnpm'\)/);
  assert.doesNotMatch(setup, /\['template:provision', '--', '--yes'\]/);
});

test('CLI formats and checks the renamed workspace through explicit pnpm scripts', async () => {
  const source = await read('packages/create-ai-fullstack/bin/create.mjs');

  assert.match(source, /\['run', 'format'\]/);
  assert.match(source, /\['run', 'feature:check'\]/);
  assert.doesNotMatch(source, /\['feature:check'\]/);
});

test('CLI and setup keep progress animation responsive during slow commands', async () => {
  const [cli, setup] = await Promise.all([
    read('packages/create-ai-fullstack/bin/create.mjs'),
    read('scripts/project-setup.mjs'),
  ]);

  for (const source of [cli, setup]) {
    assert.match(source, /prompts\.spinner\(\)/);
    assert.match(source, /await (?:execute|new Promise)/);
    assert.doesNotMatch(source, /spawnSync/);
  }
});
