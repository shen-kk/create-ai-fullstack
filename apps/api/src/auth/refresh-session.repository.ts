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
  ): Promise<void>;
  consume(userId: string, tokenHash: string): Promise<boolean>;
  revoke(tokenHash: string): Promise<void>;
}
