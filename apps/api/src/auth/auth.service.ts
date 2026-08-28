import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthSession, AuthSessionDevice, AuthUser } from '@template/contracts';
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
type AuthAccessToken = AuthUser & { sessionId: string };
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
    await this.identities.markActive(user.id, new Date());
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

  async verifyAccess(token: string): Promise<AuthAccessToken> {
    const payload = await this.jwt.verifyAsync<AuthAccessToken>(token);
    if (!payload.sessionId || !(await this.refreshSessions.isActive(payload.id, payload.sessionId)))
      throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
    return payload;
  }
  async updateProfile(id: string, name: string, avatarUrl?: string | null): Promise<AuthUser> {
    const current = avatarUrl === undefined ? await this.identities.findActiveById(id) : null;
    if (avatarUrl === undefined && !current) throw new NotFoundException('USER_NOT_FOUND');
    const user = await this.identities.updateProfile(
      id,
      name.trim(),
      avatarUrl === undefined ? (current?.avatarUrl ?? null) : avatarUrl,
    );
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
  listSessions(id: string, currentSessionId: string): Promise<AuthSessionDevice[]> {
    return this.refreshSessions.list(id, currentSessionId);
  }
  revokeOtherSessions(id: string, currentSessionId: string): Promise<number> {
    return this.refreshSessions.revokeOthers(id, currentSessionId);
  }

  private async issueSession(
    user: AuthUser,
    metadata: RefreshSessionMetadata,
  ): Promise<AuthSession & { refreshToken: string }> {
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      { secret: this.refreshSecret, expiresIn: refreshLifetimeSeconds },
    );
    const sessionId = await this.refreshSessions.create(
      user.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + refreshLifetimeSeconds * 1000),
      metadata,
    );
    const accessToken = await this.jwt.signAsync({ ...user, sessionId }, { expiresIn: '15m' });
    return { accessToken, refreshToken, expiresIn: 900, user };
  }
}
