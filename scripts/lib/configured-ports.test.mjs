import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Admin development server uses the configured port', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../apps/admin/package.json', import.meta.url), 'utf8'),
  );
  const viteConfig = await readFile(
    new URL('../../apps/admin/vite.config.ts', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.scripts.dev, 'vite');
  assert.match(viteConfig, /process\.env\.ADMIN_PORT/);
  assert.match(viteConfig, /project\.runtime\.adminPort/);
  assert.doesNotMatch(viteConfig, /3000/);
});

test('local startup helpers use project-configured ports', async () => {
  const prepare = await readFile(new URL('../prepare-local.ps1', import.meta.url), 'utf8');
  const wait = await readFile(new URL('../wait-for-local.ps1', import.meta.url), 'utf8');

  for (const source of [prepare, wait]) {
    assert.match(source, /projectConfig\.runtime\.adminPort/);
    assert.match(source, /projectConfig\.runtime\.apiPort/);
    assert.match(source, /projectConfig\.runtime\.webPort/);
  }
});
