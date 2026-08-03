import assert from 'node:assert/strict';
import test from 'node:test';
import { enabledPackages } from './enabled-tasks.mjs';

test('includes Web when the user-facing capability is enabled', () => {
  assert.ok(
    enabledPackages({ modules: { userWeb: true, customerAuthentication: true } }, 'build').includes(
      '@template/web',
    ),
  );
});

test('excludes Web when the user-facing capability is disabled', () => {
  assert.ok(
    !enabledPackages(
      { modules: { userWeb: false, customerAuthentication: false } },
      'build',
    ).includes('@template/web'),
  );
});
