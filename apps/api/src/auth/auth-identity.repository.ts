import type { AuthUser } from '@template/contracts';

export const authIdentityRepositoryToken = Symbol('AuthIdentityRepository');

export interface AuthIdentityRepository {
  authenticate(phone: string, password: string): Promise<AuthUser | null>;
  markActive(id: string, activeAt: Date): Promise<void>;
  findActiveById(id: string): Promise<AuthUser | null>;
  updateProfile(id: string, name: string, avatarUrl: string | null): Promise<AuthUser | null>;
  changePassword(id: string, currentPassword: string, newPasswordHash: string): Promise<boolean>;
}
