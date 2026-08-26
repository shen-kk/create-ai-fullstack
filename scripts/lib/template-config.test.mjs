import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseEnv,
  provisionCommands,
  renderAdminFeatureRoutes,
  renderApiFeatureModules,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './template-config.mjs';
import { modulesForFeatures } from '../../packages/create-ai-fullstack/lib/features.mjs';

const valid = {
  schemaVersion: 2,
  template: {
    name: 'adminback-template',
    version: '0.1.0',
    repository: 'https://github.com/shen-kk/create-ai-fullstack',
  },
  project: {
    name: 'demo-project',
    packageScope: '@demo-project',
    displayName: '演示项目',
    description: '测试',
  },
  runtime: { packageManager: 'pnpm', adminPort: 3000, apiPort: 3001, webPort: 3002 },
  database: { mode: 'prisma', engine: 'postgresql', orm: 'prisma' },
  localization: { defaultLocale: 'zh-CN', supportedLocales: ['zh-CN'] },
  ui: {
    web: {
      businessComponents: 'shadcn-vue',
      motion: 'vueuse-motion',
      orchestration: 'gsap',
      designStandard: 'apple-linear-vercel',
    },
  },
  features: [],
  modules: modulesForFeatures([]),
  providers: { objectStorage: 'none' },
};
test('accepts a valid core project', () => assert.deepEqual(validateProjectConfig(valid), []));
test('rejects conflicting ports', () =>
  assert.ok(
    validateProjectConfig({
      ...valid,
      runtime: { adminPort: 3000, apiPort: 3000, webPort: 3002 },
    }).some((item) => item.includes('端口')),
  ));
test('requires modules to be derived from selected features', () =>
  assert.ok(
    validateProjectConfig({
      ...valid,
      modules: { ...valid.modules, userWeb: true, customerAuthentication: false },
    }).some((item) => item.includes('自动推导')),
  ));
test('parses values containing equals signs', () =>
  assert.equal(parseEnv('TOKEN=a=b=c\n').TOKEN, 'a=b=c'));
test('renders AI context without secrets', () => {
  const output = renderProjectContext(valid);
  assert.match(output, /demo-project/);
  assert.match(output, /仅核心功能/);
  assert.doesNotMatch(output, /DATABASE_URL|JWT_ACCESS_SECRET/);
});
test('rejects the removed memory mode', () =>
  assert.ok(
    validateProjectConfig({ ...valid, database: { mode: 'memory', engine: 'none', orm: 'none' } })
      .length,
  ));
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
  assert.match(output, /"mode": "prisma"/);
  assert.match(output, /"apiPort": 3001/);
  assert.doesNotMatch(output, /DATABASE_URL|password/i);
});
test('core composition has no optional API imports or Admin routes', () => {
  assert.doesNotMatch(renderApiFeatureModules(valid), /CustomerAuth|Deployments/);
  assert.doesNotMatch(renderAdminFeatureRoutes(valid), /customers|deployments/);
});
test('full composition generates optional API imports and Admin routes', () => {
  const full = {
    ...valid,
    features: ['customerWeb', 'customerAvatar', 'deploymentCenter'],
  };
  assert.match(renderApiFeatureModules(full), /CustomerAuthModule/);
  assert.match(renderApiFeatureModules(full), /DeploymentsModule/);
  assert.match(renderAdminFeatureRoutes(full), /verification-deliveries/);
  assert.match(renderAdminFeatureRoutes(full), /deployments\/runs/);
});
