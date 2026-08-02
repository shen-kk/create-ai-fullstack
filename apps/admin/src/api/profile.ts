import type { AuthUser, ChangePasswordRequest, UpdateProfileRequest } from '@template/contracts';
import { getAccessToken } from '../auth/session';
const base = `${window.location.protocol}//${window.location.hostname}:3001/api`;
async function request<T>(path: string, method: 'PATCH' | 'POST', body: object): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${base}${path}`, {
    method,
    signal: AbortSignal.timeout(6000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const updateProfile = (input: UpdateProfileRequest): Promise<AuthUser> =>
  request('/auth/profile', 'PATCH', input);
export const changePassword = (input: ChangePasswordRequest): Promise<void> =>
  request('/auth/password', 'POST', input);
export async function uploadAvatar(file: File): Promise<AuthUser> {
  const token = getAccessToken();
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${base}/auth/avatar`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { code?: string } | undefined;
    throw new Error(payload?.code ?? `AVATAR_UPLOAD_FAILED_${response.status}`);
  }
  return response.json() as Promise<AuthUser>;
}
