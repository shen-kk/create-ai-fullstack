import type { AuthSession } from '@template/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length(): number {
    return this.#values.size;
  }
  clear(): void {
    this.#values.clear();
  }
  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

const session: AuthSession = {
  accessToken: 'test-access-token',
  expiresIn: 900,
  user: {
    id: 'usr_test',
    name: '测试管理员',
    phone: '13800000000',
    email: null,
    avatarUrl: null,
    permissions: ['menu.dashboard'],
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } });
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.restoreAllMocks();
});

describe('admin session', () => {
  it('does not restore a token when refresh finishes after logout', async () => {
    const pending = Promise.withResolvers<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/auth/refresh')
          ? pending.promise
          : Promise.resolve(new Response(null, { status: 204 })),
      ),
    );
    const { refreshAccessToken, logout, getAccessToken } = await import('../src/auth/session.js');
    const refreshing = refreshAccessToken();
    await logout();
    pending.resolve(Response.json(session));
    await expect(refreshing).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
  });
  it('shares one refresh across concurrent business requests and preserves upload headers', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/login')) return Promise.resolve(Response.json(session));
      if (url.endsWith('/auth/refresh'))
        return Promise.resolve(Response.json({ ...session, accessToken: 'new-token' }));
      if (new Headers(init?.headers).get('Authorization') !== 'Bearer new-token')
        return Promise.resolve(Response.json({ code: 'INVALID_ACCESS_TOKEN' }, { status: 401 }));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { login, clearSession } = await import('../src/auth/session.js');
    const { request, queryString } = await import('../src/api/request.js');
    await login({ phone: '13800000000', password: 'password' });
    await expect(Promise.all([request('/one'), request('/two')])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    const body = new FormData();
    body.append('file', new Blob(['avatar']), 'avatar.png');
    await request('/upload', { method: 'POST', body });
    const upload = fetchMock.mock.calls.at(-1)?.[1];
    expect(new Headers(upload?.headers).has('Content-Type')).toBe(false);
    expect(upload?.body).toBe(body);
    expect(queryString({ keyword: 'a & b', page: 1, blank: '', unset: undefined })).toBe(
      'keyword=a+%26+b&page=1',
    );
    clearSession();
  });

  it('preserves stable business errors without retrying forbidden operations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ code: 'PERMISSION_DENIED' }, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { request } = await import('../src/api/request.js');
    await expect(request('/users')).rejects.toThrow('PERMISSION_DENIED');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('persists a successful phone login without storing the password', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { getAccessToken, getCurrentUser, login } = await import('../src/auth/session.js');

    await expect(login({ phone: '13800000000', password: 'Admin@123456' })).resolves.toEqual(
      session.user,
    );
    expect(getAccessToken()).toBe(session.accessToken);
    expect(getCurrentUser()).toEqual(session.user);
    expect(sessionStorage.getItem('template_access_token')).not.toContain('Admin@123456');
    expect(sessionStorage.getItem('template_auth_user')).not.toContain('Admin@123456');
  });

  it('notifies the admin shell immediately after the first login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { login, onSessionChanged } = await import('../src/auth/session.js');
    const listener = vi.fn();
    const unsubscribe = onSessionChanged(listener);

    await login({ phone: '13800000000', password: 'Admin@123456' });

    expect(listener).toHaveBeenCalledWith(session.user);
    unsubscribe();
  });

  it('clears local state even when the logout API is unavailable', async () => {
    sessionStorage.setItem('template_access_token', session.accessToken);
    sessionStorage.setItem('template_auth_user', JSON.stringify(session.user));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { getAccessToken, getCurrentUser, logout } = await import('../src/auth/session.js');

    await logout();
    expect(getAccessToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it('rejects an invalid stored user payload', async () => {
    sessionStorage.setItem('template_auth_user', '{invalid json');
    const { getCurrentUser } = await import('../src/auth/session.js');

    expect(getCurrentUser()).toBeNull();
    expect(sessionStorage.getItem('template_auth_user')).toBeNull();
  });
});
