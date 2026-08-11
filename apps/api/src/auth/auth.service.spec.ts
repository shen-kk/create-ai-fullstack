import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '@template/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthIdentityRepository } from './auth-identity.repository.js';
import { AuthService } from './auth.service.js';
import type {
  RefreshSessionMetadata,
  RefreshSessionRepository,
} from './refresh-session.repository.js';

const testPhone = '13800000000';
const testPassword = 'TestAdmin@123456';

class TestAuthIdentityRepository implements AuthIdentityRepository {
  private readonly user: AuthUser = {
    id: 'adm_test',
    name: '测试管理员',
    phone: testPhone,
    email: 'admin@example.com',
    avatarUrl: null,
    permissions: ['menu.dashboard'],
  };

  authenticate(phone: string, password: string): Promise<AuthUser | null> {
    return Promise.resolve(phone === testPhone && password === testPassword ? this.user : null);
  }

  markActive(): Promise<void> {
    return Promise.resolve();
  }

  findActiveById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(id === this.user.id ? this.user : null);
  }

  updateProfile(id: string, name: string, avatarUrl: string | null): Promise<AuthUser | null> {
    if (id !== this.user.id) return Promise.resolve(null);
    this.user.name = name;
    this.user.avatarUrl = avatarUrl;
    return Promise.resolve(this.user);
  }

  changePassword(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class TestRefreshSessionRepository implements RefreshSessionRepository {
  private readonly sessions = new Map<string, { userId: string; expiresAt: Date; revoked: boolean }>();

  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    _metadata: RefreshSessionMetadata,
  ): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt, revoked: false });
    return Promise.resolve();
  }

  consume(userId: string, tokenHash: string): Promise<boolean> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.userId !== userId || session.revoked || session.expiresAt <= new Date())
      return Promise.resolve(false);
    session.revoked = true;
    return Promise.resolve(true);
  }

  revoke(tokenHash: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revoked = true;
    return Promise.resolve();
  }
}

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-access-secret-that-is-long-enough' });
  const identities = new TestAuthIdentityRepository();
  const service = new AuthService(jwt, identities, new TestRefreshSessionRepository());

  beforeEach(() => vi.restoreAllMocks());

  it('issues a session for the development administrator', async () => {
    const markActive = vi.spyOn(identities, 'markActive');
    const session = await service.login(testPhone, testPassword);
    expect(session.user.email).toBe('admin@example.com');
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(markActive).toHaveBeenCalledWith('adm_test', expect.any(Date));
  });

  it('rejects an invalid password', async () => {
    const markActive = vi.spyOn(identities, 'markActive');
    await expect(service.login(testPhone, 'wrong-password')).rejects.toThrow(
      'INVALID_CREDENTIALS',
    );
    expect(markActive).not.toHaveBeenCalled();
  });

  it('rejects a validly signed refresh token for an unknown user', async () => {
    const token = await jwt.signAsync(
      { sub: 'missing-user' },
      { secret: 'development-refresh-secret-change-me' },
    );
    await expect(service.refresh(token)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });

  it('rotates refresh tokens and rejects replay', async () => {
    const session = await service.login(testPhone, testPassword);
    const rotated = await service.refresh(session.refreshToken);
    expect(rotated.refreshToken).toBeTruthy();
    await expect(service.refresh(session.refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });

  it('rejects a refresh token after logout', async () => {
    const session = await service.login(testPhone, testPassword);
    await service.logout(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });
});
