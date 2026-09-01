import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

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
