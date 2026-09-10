import type {
  AuthSessionDevice,
  AuthUser,
  ChangePasswordRequest,
  UpdateProfileRequest,
} from '@template/contracts';
import { request } from './request';
export const updateProfile = (input: UpdateProfileRequest): Promise<AuthUser> =>
  request('/auth/profile', { method: 'PATCH', body: JSON.stringify(input) });
export const changePassword = (input: ChangePasswordRequest): Promise<void> =>
  request('/auth/password', { method: 'POST', body: JSON.stringify(input) });
export const listAuthSessions = (): Promise<AuthSessionDevice[]> => request('/auth/sessions');
export const revokeOtherAuthSessions = (): Promise<void> =>
  request('/auth/sessions/others', { method: 'DELETE' });
export function uploadAvatar(file: File): Promise<AuthUser> {
  const body = new FormData();
  body.append('file', file);
  return request('/auth/avatar', { method: 'POST', body }, 30_000);
}
