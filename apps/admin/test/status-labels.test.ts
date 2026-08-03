import { describe, expect, it } from 'vitest';

import {
  auditResultLabel,
  integrationErrorLabel,
  verificationStatusLabel,
} from '../src/status-labels.js';

describe('admin status labels', () => {
  it('renders audit results in Chinese by default', () => {
    expect(auditResultLabel('success')).toBe('成功');
    expect(auditResultLabel('failure')).toBe('失败');
    expect(auditResultLabel('unexpected')).toBe('未知结果');
  });

  it('renders verification delivery states in Chinese by default', () => {
    expect(verificationStatusLabel('sent')).toBe('已发送');
    expect(verificationStatusLabel('consumed')).toBe('已验证');
    expect(verificationStatusLabel('expired')).toBe('已过期');
  });

  it('does not expose integration error codes as user-facing text', () => {
    expect(integrationErrorLabel('SMS_CONFIG_INCOMPLETE')).toBe('短信配置不完整');
    expect(integrationErrorLabel('UNKNOWN_CODE')).toBe('服务发送异常');
  });
});
