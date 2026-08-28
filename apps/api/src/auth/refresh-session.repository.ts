import type { AuthSessionDevice } from '@template/contracts';

export const refreshSessionRepositoryToken = Symbol('RefreshSessionRepository');

export interface RefreshSessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshSessionRepository {
  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: RefreshSessionMetadata,
  ): Promise<string>;
  consume(userId: string, tokenHash: string): Promise<boolean>;
  revoke(tokenHash: string): Promise<void>;
  isActive(userId: string, id: string): Promise<boolean>;
  list(userId: string, currentSessionId: string): Promise<AuthSessionDevice[]>;
  revokeOthers(userId: string, currentSessionId: string): Promise<number>;
}
