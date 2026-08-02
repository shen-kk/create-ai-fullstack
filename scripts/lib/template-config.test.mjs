import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseEnv,
  presetModules,
  provisionCommands,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './template-config.mjs';

const valid = {
  schemaVersion: 1,
  template: {
    name: 'adminback-template',
    version: '0.1.0',
    repository: 'https://cnb.cool/nsmiling.com/ai-template',
  },
  project: {
    name: 'demo-project',
    packageScope: '@demo-project',
    displayName: '演示项目',
    description: '测试',
  },
  runtime: { adminPort: 3000, apiPort: 3001 },
  database: { mode: 'memory', engine: 'none', orm: 'none' },
  modules: presetModules('quick'),
  providers: { objectStorage: 'tencent_cos' },
};
test('accepts a valid quick preset', () => assert.deepEqual(validateProjectConfig(valid), []));
test('rejects conflicting ports', () =>
  assert.ok(
    validateProjectConfig({ ...valid, runtime: { adminPort: 3000, apiPort: 3000 } }).some((item) =>
      item.includes('端口'),
    ),
  ));
test('parses values containing equals signs', () =>
  assert.equal(parseEnv('TOKEN=a=b=c\n').TOKEN, 'a=b=c'));
test('renders AI context without secrets', () => {
  const output = renderProjectContext(valid);
  assert.match(output, /demo-project/);
  assert.match(output, /tencent_cos/);
  assert.doesNotMatch(output, /DATABASE_URL|JWT_ACCESS_SECRET/);
});
test('does not provision a database in memory mode', () =>
  assert.deepEqual(provisionCommands(valid), []));
test('plans generate, deploy and seed for prisma mode', () => {
  const commands = provisionCommands({
    ...valid,
    database: { mode: 'prisma', engine: 'postgresql', orm: 'prisma' },
  });
  assert.equal(commands.length, 3);
  assert.deepEqual(commands[1].slice(-3), ['prisma', 'migrate', 'deploy']);
});
test('renders a secret-free runtime module', () => {
  const output = renderRuntimeProject(valid);
  assert.match(output, /demo-project/);
  assert.match(output, /rolesAndPermissions/);
  assert.doesNotMatch(output, /DATABASE_URL|password/i);
});
