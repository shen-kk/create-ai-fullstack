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
  private nextId = 1;
  private readonly sessions = new Map<
    string,
    { id: string; userId: string; expiresAt: Date; revoked: boolean }
  >();

  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: RefreshSessionMetadata,
  ): Promise<string> {
    void metadata;
    const id = `session-${this.nextId++}`;
    this.sessions.set(tokenHash, { id, userId, expiresAt, revoked: false });
    return Promise.resolve(id);
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

  isActive(userId: string, id: string): Promise<boolean> {
    return Promise.resolve(
      [...this.sessions.values()].some(
        (session) => session.id === id && session.userId === userId && !session.revoked,
      ),
    );
  }

  list(userId: string, currentSessionId: string) {
    return Promise.resolve(
      [...this.sessions.values()]
        .filter((session) => session.userId === userId && !session.revoked)
        .map((session) => ({
          id: session.id,
          userAgent: null,
          ipAddress: null,
          createdAt: new Date(0).toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          current: session.id === currentSessionId,
        })),
    );
  }

  revokeOthers(userId: string, currentSessionId: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values())
      if (session.userId === userId && session.id !== currentSessionId && !session.revoked) {
        session.revoked = true;
        count += 1;
      }
    return Promise.resolve(count);
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
    await expect(service.login(testPhone, 'wrong-password')).rejects.toThrow('INVALID_CREDENTIALS');
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

  it('lists the current device and immediately invalidates other device access tokens', async () => {
    const first = await service.login(testPhone, testPassword);
    const second = await service.login(testPhone, testPassword);
    const current = await service.verifyAccess(second.accessToken);
    const devices = await service.listSessions(current.id, current.sessionId);
    expect(devices.length).toBeGreaterThanOrEqual(2);
    expect(devices.filter((device) => device.current)).toHaveLength(1);

    await service.revokeOtherSessions(current.id, current.sessionId);
    await expect(service.verifyAccess(first.accessToken)).rejects.toThrow('INVALID_ACCESS_TOKEN');
    await expect(service.verifyAccess(second.accessToken)).resolves.toMatchObject({
      id: 'adm_test',
      sessionId: current.sessionId,
    });
  });
});
