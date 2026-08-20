import type { AuthSession, AuthUser, LoginRequest } from '@template/contracts';
import { apiBaseUrl } from '../api/base';

const tokenKey = 'template_access_token';
const userKey = 'template_auth_user';
const versionKey = 'template_session_version';
const expiryKey = 'template_access_expires_at';
const currentSessionVersion = '4';
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export const getAccessToken = (): string | null => sessionStorage.getItem(tokenKey);
export function getCurrentUser(): AuthUser | null {
  const value = sessionStorage.getItem(userKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    sessionStorage.removeItem(userKey);
    return null;
  }
}
export function clearSession(): void {
  if (refreshTimer !== undefined) globalThis.clearTimeout(refreshTimer);
  refreshTimer = undefined;
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(userKey);
  sessionStorage.removeItem(versionKey);
  sessionStorage.removeItem(expiryKey);
}
function saveSession(session: AuthSession): void {
  sessionStorage.setItem(tokenKey, session.accessToken);
  sessionStorage.setItem(userKey, JSON.stringify(session.user));
  sessionStorage.setItem(versionKey, currentSessionVersion);
  const expiresAt = Date.now() + Math.max(60, session.expiresIn - 60) * 1000;
  sessionStorage.setItem(expiryKey, String(Date.now() + session.expiresIn * 1000));
  if (refreshTimer !== undefined) globalThis.clearTimeout(refreshTimer);
  refreshTimer = globalThis.setTimeout(
    () => {
      void refreshAccessToken();
    },
    Math.max(1000, expiresAt - Date.now()),
  );
}
export function saveCurrentUser(user: AuthUser): void {
  sessionStorage.setItem(userKey, JSON.stringify(user));
}

export async function login(input: LoginRequest): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('LOGIN_FAILED');
  const session = (await response.json()) as AuthSession;
  saveSession(session);
  return session.user;
}

export async function restoreSession(): Promise<boolean> {
  try {
    if (sessionStorage.getItem(versionKey) !== currentSessionVersion) clearSession();
    const token = getAccessToken();
    const expiresAt = Number(sessionStorage.getItem(expiryKey) ?? 0);
    if (token && getCurrentUser() && expiresAt > Date.now() + 60_000) {
      scheduleRefresh(expiresAt);
      return true;
    }
    if (token) {
      const me = await fetch(`${apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (me.ok && expiresAt > Date.now()) {
        sessionStorage.setItem(userKey, JSON.stringify((await me.json()) as AuthUser));
        return true;
      }
      clearSession();
    }
    return await refreshAccessToken();
  } catch {
    clearSession();
    return false;
  }
}

function scheduleRefresh(expiresAt: number): void {
  if (refreshTimer !== undefined) globalThis.clearTimeout(refreshTimer);
  refreshTimer = globalThis.setTimeout(
    () => void refreshAccessToken(),
    Math.max(1000, expiresAt - Date.now() - 60_000),
  );
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('REFRESH_FAILED');
    saveSession((await response.json()) as AuthSession);
    return true;
  } catch {
    clearSession();
    window.dispatchEvent(new CustomEvent('template-auth-expired'));
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    /* Local logout must still complete when the API is unavailable. */
  }
  clearSession();
}
