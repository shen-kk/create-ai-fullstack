import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ecosystemSource = readFileSync(
  new URL('../../ecosystem.config.cjs', import.meta.url),
  'utf8',
);

function loadEcosystem(config, { webSourceExists = true, env = {} } = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ecosystemSource, {
    module,
    exports: module.exports,
    __dirname: '/project',
    process: { env },
    require(specifier) {
      if (specifier === './project.config.json') return config;
      if (specifier === 'node:fs') return { existsSync: () => webSourceExists };
      return require(specifier);
    },
  });
  return module.exports;
}

test('PM2 ecosystem reads project name, modules and runtime from the full project config', () => {
  const previousWebPort = process.env.WEB_PORT;
  delete process.env.WEB_PORT;

  try {
    const config = require('../../project.config.json');
    const ecosystem = require('../../ecosystem.config.cjs');
    const apps = ecosystem.apps;

    assert.equal(apps[0]?.name, `${config.project.name}-api`);
    assert.equal(
      apps.some((app) => app.name === `${config.project.name}-web`),
      config.modules.userWeb,
    );

    if (config.modules.userWeb) {
      const web = apps.find((app) => app.name === `${config.project.name}-web`);
      assert.equal(web?.env?.PORT, String(config.runtime.webPort));
    }
  } finally {
    if (previousWebPort === undefined) delete process.env.WEB_PORT;
    else process.env.WEB_PORT = previousWebPort;
  }
});

test('PM2 ecosystem supports legacy project configs without a modules node', () => {
  const ecosystem = loadEcosystem({
    project: { name: 'legacy-project' },
    runtime: { webPort: 4102 },
    features: ['customerWeb'],
  });

  assert.equal(
    ecosystem.apps.map((app) => app.name).join(','),
    'legacy-project-api,legacy-project-web',
  );
  assert.equal(ecosystem.apps[1].env.PORT, '4102');
});

test('PM2 ecosystem detects Web source for configs without modules or features', () => {
  const ecosystem = loadEcosystem(
    {
      project: {
        name: 'older-project',
        runtime: { webPort: 4202 },
      },
    },
    { webSourceExists: true },
  );

  assert.equal(ecosystem.apps[1].name, 'older-project-web');
  assert.equal(ecosystem.apps[1].env.PORT, '4202');
});
