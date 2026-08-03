import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';

interface MemorySession {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class CustomerSessionRepository {
  private readonly sessions: MemorySession[] = [];
  constructor(private readonly prisma: PrismaService) {}
  async create(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.customerRefreshSession.create({
        data: {
          customerId,
          tokenHash,
          expiresAt,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        },
      });
      return;
    }
    this.sessions.push({ id: randomUUID(), customerId, tokenHash, expiresAt, revokedAt: null });
  }
  async consume(customerId: string, tokenHash: string): Promise<boolean> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const result = await this.prisma.customerRefreshSession.updateMany({
        where: { customerId, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      return result.count === 1;
    }
    const item = this.sessions.find(
      (session) =>
        session.customerId === customerId &&
        session.tokenHash === tokenHash &&
        !session.revokedAt &&
        session.expiresAt > new Date(),
    );
    if (!item) return false;
    item.revokedAt = new Date();
    return true;
  }
  async revoke(tokenHash: string): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.customerRefreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    const item = this.sessions.find((session) => session.tokenHash === tokenHash);
    if (item) item.revokedAt = new Date();
  }
  async revokeAll(customerId: string): Promise<void> {
    if (process.env.DATA_SOURCE === 'prisma') {
      await this.prisma.customerRefreshSession.updateMany({
        where: { customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    for (const item of this.sessions)
      if (item.customerId === customerId && !item.revokedAt) item.revokedAt = new Date();
  }
}
