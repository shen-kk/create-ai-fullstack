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
