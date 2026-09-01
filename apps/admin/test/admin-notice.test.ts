import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminNotice, dismissAdminNotice, showAdminNotice } from '../src/components/admin-notice';

describe('admin notice', () => {
  afterEach(() => {
    dismissAdminNotice();
    vi.useRealTimers();
  });

  it('creates a new event when the same message is shown repeatedly', () => {
    showAdminNotice('success', '保存成功');
    const firstId = adminNotice.value?.id;
    showAdminNotice('success', '保存成功');

    expect(adminNotice.value).toMatchObject({ kind: 'success', message: '保存成功' });
    expect(adminNotice.value?.id).not.toBe(firstId);
  });

  it('keeps error semantics explicit and dismisses automatically', () => {
    vi.useFakeTimers();
    showAdminNotice('error', '保存失败');
    expect(adminNotice.value?.kind).toBe('error');

    vi.advanceTimersByTime(6500);
    expect(adminNotice.value).toBeUndefined();
  });
});
