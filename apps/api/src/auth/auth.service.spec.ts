import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';

import { AuthService } from './auth.service.js';
import { MemoryAuthIdentityRepository } from './memory-auth-identity.repository.js';
import { MemoryRefreshSessionRepository } from './memory-refresh-session.repository.js';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-access-secret-that-is-long-enough' });
  const service = new AuthService(
    jwt,
    new MemoryAuthIdentityRepository(),
    new MemoryRefreshSessionRepository(),
  );

  it('issues a session for the development administrator', async () => {
    const session = await service.login('13800000000', 'Admin@123456');
    expect(session.user.email).toBe('admin@example.com');
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
  });

  it('rejects an invalid password', async () => {
    await expect(service.login('13800000000', 'wrong-password')).rejects.toThrow(
      'INVALID_CREDENTIALS',
    );
  });

  it('rejects a validly signed refresh token for an unknown user', async () => {
    const token = await jwt.signAsync(
      { sub: 'missing-user' },
      { secret: 'development-refresh-secret-change-me' },
    );
    await expect(service.refresh(token)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });

  it('rotates refresh tokens and rejects replay', async () => {
    const session = await service.login('13800000000', 'Admin@123456');
    const rotated = await service.refresh(session.refreshToken);
    expect(rotated.refreshToken).toBeTruthy();
    await expect(service.refresh(session.refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });

  it('rejects a refresh token after logout', async () => {
    const session = await service.login('13800000000', 'Admin@123456');
    await service.logout(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });
});
