import { Injectable } from '@nestjs/common';
import type {
  RefreshSessionMetadata,
  RefreshSessionRepository,
} from './refresh-session.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthSessionDevice } from '@template/contracts';

@Injectable()
export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: RefreshSessionMetadata,
  ): Promise<string> {
    const session = await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      },
    });
    return session.id;
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

  async isActive(userId: string, id: string): Promise<boolean> {
    return (
      (await this.prisma.refreshSession.count({
        where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      })) === 1
    );
  }

  async list(userId: string, currentSessionId: string): Promise<AuthSessionDevice[]> {
    const rows = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.id === currentSessionId,
    }));
  }

  async revokeOthers(userId: string, currentSessionId: string): Promise<number> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
