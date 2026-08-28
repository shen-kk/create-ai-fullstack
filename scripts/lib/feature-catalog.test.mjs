import assert from 'node:assert/strict';
import test from 'node:test';
import {
  modulesForFeatures,
  resolveFeatures,
} from '../../packages/create-ai-fullstack/lib/features.mjs';

test('CLI 只暴露用户端这一项可裁剪功能', () => {
  assert.deepEqual(resolveFeatures(['customerWeb']), ['customerWeb']);
  assert.throws(() => resolveFeatures(['customerAvatar']), /未知功能/);
  assert.throws(() => resolveFeatures(['deploymentCenter']), /未知功能/);
});

test('用户端自动推导验证码所需共享基础模块', () => {
  const modules = modulesForFeatures(['customerWeb']);
  assert.equal(modules.userWeb, true);
  assert.equal(modules.customerAuthentication, true);
  assert.equal(modules.redis, true);
  assert.equal(modules.email, true);
  assert.equal(modules.sms, true);
});

test('基础设施不是用户可独立选择的功能', () => {
  assert.throws(() => resolveFeatures(['email']), /未知功能/);
  assert.throws(() => resolveFeatures(['redis']), /未知功能/);
  const core = modulesForFeatures([]);
  assert.equal(core.deploymentCenter, true);
  assert.equal(core.objectStorage, true);
});
