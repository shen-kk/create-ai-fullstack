import { Injectable } from '@nestjs/common';
import type {
  RefreshSessionMetadata,
  RefreshSessionRepository,
} from './refresh-session.repository.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: RefreshSessionMetadata,
  ): Promise<void> {
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      },
    });
  }

  async consume(userId: string, tokenHash: string): Promise<boolean> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { userId, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
