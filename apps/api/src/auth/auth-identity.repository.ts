import type { AuthUser } from '@template/contracts';

export const authIdentityRepositoryToken = Symbol('AuthIdentityRepository');

export interface AuthIdentityRepository {
  authenticate(phone: string, password: string): Promise<AuthUser | null>;
  findActiveById(id: string): Promise<AuthUser | null>;
  updateProfile(id: string, name: string, avatarUrl: string | null): Promise<AuthUser | null>;
  changePassword(id: string, currentPassword: string, newPasswordHash: string): Promise<boolean>;
}
