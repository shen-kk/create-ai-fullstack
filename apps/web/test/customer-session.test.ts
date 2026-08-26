import type { CustomerSession } from '@template/contracts';
import { ref, type Ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = (accessToken: string): CustomerSession => ({
  accessToken,
  expiresIn: 900,
  customer: {
    id: 'customer-1',
    name: '测试用户',
    phone: '13800000000',
    email: null,
    avatarUrl: null,
    status: 'active',
    createdAt: '2026-08-03T00:00:00.000Z',
    phoneVerifiedAt: '2026-08-03T00:00:00.000Z',
    emailVerifiedAt: null,
    passwordConfigured: false,
  },
});

beforeEach(() => {
  vi.resetModules();
  const states = new Map<string, Ref<unknown>>();
  vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initialize()));
    return states.get(key);
  });
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: 'http://api.test' } }));
  vi.restoreAllMocks();
});

describe('customer session API client', () => {
  it('maps stable API error codes to Chinese user messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'INVALID_CUSTOMER_CREDENTIALS',
            message: '请求未能完成',
            requestId: 'request-1',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const { CustomerApiError, useCustomerSession } =
      await import('../app/composables/useCustomerSession.js');

    const error = await useCustomerSession()
      .login({ phone: '13800000000', password: 'wrong-password' })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CustomerApiError);
    expect(error).toMatchObject({
      code: 'INVALID_CUSTOMER_CREDENTIALS',
      message: '账号或密码错误',
      requestId: 'request-1',
    });
  });

  it('refreshes an expired access token and retries the request once', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/login')) return Response.json(session('old-token'));
      if (url.endsWith('/refresh')) return Response.json(session('new-token'));
      if (url.endsWith('/sessions')) {
        const authorization = new Headers(init?.headers).get('Authorization');
        if (authorization === 'Bearer old-token')
          return Response.json({ code: 'UNAUTHORIZED', message: '请求未能完成' }, { status: 401 });
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { useCustomerSession } = await import('../app/composables/useCustomerSession.js');
    const api = useCustomerSession();

    await api.login({ phone: '13800000000', password: 'Customer@123' });
    await expect(api.listSessions()).resolves.toEqual([]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/refresh'))).toHaveLength(
      1,
    );
    expect(api.accessToken.value).toBe('new-token');
  });

  it('clears local identity when logout API is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(session('access-token')))
      .mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { useCustomerSession } = await import('../app/composables/useCustomerSession.js');
    const api = useCustomerSession();

    await api.login({ phone: '13800000000', password: 'Customer@123' });
    await expect(api.logout()).rejects.toThrow('网络连接失败，请稍后重试');
    expect(api.customer.value).toBeNull();
    expect(api.accessToken.value).toBe('');
  });

  it('marks the current customer password as configured after the first setup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(session('access-token')))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { useCustomerSession } = await import('../app/composables/useCustomerSession.js');
    const api = useCustomerSession();

    await api.login({ phone: '13800000000', password: 'Customer@123' });
    expect(api.customer.value?.passwordConfigured).toBe(false);
    await api.changePassword({ newPassword: 'Customer@456' });
    expect(api.customer.value?.passwordConfigured).toBe(true);
  });
});
