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
  runtime: { adminPort: 3000, apiPort: 3001, webPort: 3002 },
  database: { mode: 'memory', engine: 'none', orm: 'none' },
  localization: { defaultLocale: 'zh-CN', supportedLocales: ['zh-CN'] },
  ui: {
    web: {
      businessComponents: 'shadcn-vue',
      motion: 'vueuse-motion',
      orchestration: 'gsap',
      designStandard: 'apple-linear-vercel',
    },
  },
  modules: presetModules('quick'),
  providers: { objectStorage: 'tencent_cos' },
};
test('accepts a valid quick preset', () => assert.deepEqual(validateProjectConfig(valid), []));
test('rejects conflicting ports', () =>
  assert.ok(
    validateProjectConfig({
      ...valid,
      runtime: { adminPort: 3000, apiPort: 3000, webPort: 3002 },
    }).some((item) => item.includes('端口')),
  ));
test('requires user web and customer authentication to change together', () =>
  assert.ok(
    validateProjectConfig({
      ...valid,
      modules: { ...valid.modules, userWeb: true, customerAuthentication: false },
    }).some((item) => item.includes('同时启用或停用')),
  ));
test('requires sms and redis for the user identity baseline', () =>
  assert.ok(
    validateProjectConfig({
      ...valid,
      modules: {
        ...valid.modules,
        userWeb: true,
        customerAuthentication: true,
        sms: false,
        redis: false,
      },
    }).some((item) => item.includes('sms 与 redis')),
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
  assert.equal(commands.length, 4);
  assert.equal(commands[0][1], '@demo-project/contracts');
  assert.equal(commands[1][1], '@demo-project/api');
  assert.deepEqual(commands[2].slice(-3), ['prisma', 'migrate', 'deploy']);
});
test('renders a secret-free runtime module', () => {
  const output = renderRuntimeProject(valid);
  assert.match(output, /demo-project/);
  assert.match(output, /rolesAndPermissions/);
  assert.doesNotMatch(output, /DATABASE_URL|password/i);
});
