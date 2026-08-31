import { ref, type Ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  const states = new Map<string, Ref<unknown>>();
  vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initialize()));
    return states.get(key);
  });
});

describe('app toast', () => {
  it('creates a new notification for repeated identical errors', async () => {
    const { useAppToast } = await import('../app/composables/useAppToast.js');
    const { toast, showError } = useAppToast();

    showError('请求失败');
    const firstId = toast.value?.id;
    showError('请求失败');

    expect(toast.value).toMatchObject({ message: '请求失败', tone: 'error' });
    expect(toast.value?.id).not.toBe(firstId);
  });
});
