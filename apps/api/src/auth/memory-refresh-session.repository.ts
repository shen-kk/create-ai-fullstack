import { Injectable } from '@nestjs/common';
import type {
  RefreshSessionMetadata,
  RefreshSessionRepository,
} from './refresh-session.repository.js';

interface MemorySession {
  userId: string;
  expiresAt: Date;
  revoked: boolean;
  metadata: RefreshSessionMetadata;
}

@Injectable()
export class MemoryRefreshSessionRepository implements RefreshSessionRepository {
  private readonly sessions = new Map<string, MemorySession>();

  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: RefreshSessionMetadata,
  ): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt, revoked: false, metadata });
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
