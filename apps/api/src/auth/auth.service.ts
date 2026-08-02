import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthSession, AuthUser } from '@template/contracts';
import { randomUUID } from 'node:crypto';

import {
  authIdentityRepositoryToken,
  type AuthIdentityRepository,
} from './auth-identity.repository.js';
import { hashRefreshToken } from './refresh-token-hash.js';
import {
  refreshSessionRepositoryToken,
  type RefreshSessionMetadata,
  type RefreshSessionRepository,
} from './refresh-session.repository.js';
import { hashScryptPassword } from './password-hash.js';

interface RefreshTokenPayload {
  sub: string;
}
const refreshLifetimeSeconds = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret-change-me';

  constructor(
    private readonly jwt: JwtService,
    @Inject(authIdentityRepositoryToken) private readonly identities: AuthIdentityRepository,
    @Inject(refreshSessionRepositoryToken)
    private readonly refreshSessions: RefreshSessionRepository,
  ) {}

  async login(
    phone: string,
    password: string,
    metadata: RefreshSessionMetadata = {},
  ): Promise<AuthSession & { refreshToken: string }> {
    const user = await this.identities.authenticate(phone, password);
    if (!user) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return this.issueSession(user, metadata);
  }

  async refresh(
    token: string | undefined,
    metadata: RefreshSessionMetadata = {},
  ): Promise<AuthSession & { refreshToken: string }> {
    if (!token) throw new UnauthorizedException('REFRESH_TOKEN_REQUIRED');
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }
    if (!(await this.refreshSessions.consume(payload.sub, hashRefreshToken(token))))
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    const user = await this.identities.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    return this.issueSession(user, metadata);
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.refreshSessions.revoke(hashRefreshToken(token));
  }

  verifyAccess(token: string): Promise<AuthUser> {
    return this.jwt.verifyAsync<AuthUser>(token);
  }
  async updateProfile(id: string, name: string, avatarUrl: string | null): Promise<AuthUser> {
    const user = await this.identities.updateProfile(id, name.trim(), avatarUrl);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const changed = await this.identities.changePassword(
      id,
      currentPassword,
      await hashScryptPassword(newPassword),
    );
    if (!changed) throw new UnauthorizedException('CURRENT_PASSWORD_INVALID');
  }

  private async issueSession(
    user: AuthUser,
    metadata: RefreshSessionMetadata,
  ): Promise<AuthSession & { refreshToken: string }> {
    const accessToken = await this.jwt.signAsync(user, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      { secret: this.refreshSecret, expiresIn: refreshLifetimeSeconds },
    );
    await this.refreshSessions.create(
      user.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + refreshLifetimeSeconds * 1000),
      metadata,
    );
    return { accessToken, refreshToken, expiresIn: 900, user };
  }
}
