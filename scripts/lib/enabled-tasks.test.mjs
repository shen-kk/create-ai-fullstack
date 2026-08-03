import assert from 'node:assert/strict';
import test from 'node:test';
import { enabledPackages } from './enabled-tasks.mjs';

test('includes Web when the user-facing capability is enabled', () => {
  assert.ok(
    enabledPackages(
      {
        project: { packageScope: '@example' },
        modules: { userWeb: true, customerAuthentication: true },
      },
      'build',
    ).includes('@example/web'),
  );
});

test('excludes Web when the user-facing capability is disabled', () => {
  assert.ok(
    !enabledPackages(
      {
        project: { packageScope: '@example' },
        modules: { userWeb: false, customerAuthentication: false },
      },
      'build',
    ).includes('@example/web'),
  );
});
