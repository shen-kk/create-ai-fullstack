import type { CustomerAuthSettings } from '@template/contracts';
import { computed, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCustomerAuthSettings } from '../app/composables/useCustomerAuthSettings';

const settings: CustomerAuthSettings = {
  mode: 'email',
  availableChannels: ['email'],
  verificationTtlSeconds: 300,
  verificationRetrySeconds: 60,
  updatedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

function setup(baseURL = '/api', data: CustomerAuthSettings | null = settings) {
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: baseURL } }));
  vi.stubGlobal('useRequestURL', () => new URL('https://web.example.com/login'));
  vi.stubGlobal(
    'createError',
    (input: { statusMessage: string }) => new Error(input.statusMessage),
  );
  const fetch = vi.fn().mockResolvedValue({ data: ref(data), error: ref(null) });
  vi.stubGlobal('useFetch', fetch);
  return fetch;
}

describe('customer authentication settings', () => {
  it('uses the HTTP API entry point on page refresh instead of Nitro local routing', async () => {
    const fetch = setup();
    const result = await useCustomerAuthSettings();
    expect(fetch).toHaveBeenCalledWith(
      '/customer-auth/settings',
      expect.objectContaining({
        baseURL: 'https://web.example.com/api',
      }),
    );
    expect(result.defaultChannel.value).toBe('email');
  });

  it('preserves an explicitly configured cross-origin API', async () => {
    const fetch = setup('https://api.example.com/api');
    await useCustomerAuthSettings();
    expect(fetch).toHaveBeenCalledWith(
      '/customer-auth/settings',
      expect.objectContaining({
        baseURL: 'https://api.example.com/api',
      }),
    );
  });

  it('does not silently invent phone settings when configuration cannot be loaded', async () => {
    setup('/api', null);
    await expect(useCustomerAuthSettings()).rejects.toThrow('登录配置加载失败，请刷新页面重试');
  });
});
