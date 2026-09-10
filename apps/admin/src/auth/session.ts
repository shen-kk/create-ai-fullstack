import type { AuthSession, AuthUser, LoginRequest } from '@template/contracts';
import { apiBaseUrl } from '../api/base';

const tokenKey = 'template_access_token';
const userKey = 'template_auth_user';
const versionKey = 'template_session_version';
const expiryKey = 'template_access_expires_at';
const currentSessionVersion = '4';
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshPromise: Promise<boolean> | undefined;
let sessionVersion = 0;
const sessionListeners = new Set<(user: AuthUser | null) => void>();

function notifySessionChanged(): void {
  const user = getCurrentUser();
  for (const listener of sessionListeners) listener(user);
}

export function onSessionChanged(listener: (user: AuthUser | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

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
  sessionVersion += 1;
  if (refreshTimer !== undefined) globalThis.clearTimeout(refreshTimer);
  refreshTimer = undefined;
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(userKey);
  sessionStorage.removeItem(versionKey);
  sessionStorage.removeItem(expiryKey);
  notifySessionChanged();
}
function saveSession(session: AuthSession): void {
  sessionStorage.setItem(tokenKey, session.accessToken);
  sessionStorage.setItem(userKey, JSON.stringify(session.user));
  sessionStorage.setItem(versionKey, currentSessionVersion);
  const expiresAt = Date.now() + session.expiresIn * 1000;
  sessionStorage.setItem(expiryKey, String(expiresAt));
  notifySessionChanged();
  scheduleRefresh(expiresAt);
}
export function saveCurrentUser(user: AuthUser): void {
  sessionStorage.setItem(userKey, JSON.stringify(user));
  notifySessionChanged();
}

export async function login(input: LoginRequest): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(6000),
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
        signal: AbortSignal.timeout(6000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (me.ok && expiresAt > Date.now()) {
        sessionStorage.setItem(userKey, JSON.stringify((await me.json()) as AuthUser));
        notifySessionChanged();
        scheduleRefresh(expiresAt);
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

export function refreshAccessToken(): Promise<boolean> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = undefined;
  });
  return refreshPromise;
}

async function performRefresh(): Promise<boolean> {
  const version = sessionVersion;
  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('REFRESH_FAILED');
    const session = (await response.json()) as AuthSession;
    if (version !== sessionVersion) return false;
    saveSession(session);
    return true;
  } catch {
    if (version !== sessionVersion) return false;
    clearSession();
    window.dispatchEvent(new CustomEvent('template-auth-expired'));
    return false;
  }
}

export async function logout(): Promise<void> {
  clearSession();
  try {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    /* Local logout must still complete when the API is unavailable. */
  }
  clearSession();
}
