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
