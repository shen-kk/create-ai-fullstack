import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { CustomerSessionDevice } from '@template/contracts';

interface MemorySession {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
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
  ): Promise<string> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const session = await this.prisma.customerRefreshSession.create({
        data: {
          customerId,
          tokenHash,
          expiresAt,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        },
      });
      return session.id;
    }
    const id = randomUUID();
    this.sessions.push({
      id,
      customerId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null,
      createdAt: new Date(),
    });
    return id;
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
  async list(customerId: string, currentSessionId?: string): Promise<CustomerSessionDevice[]> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const rows = await this.prisma.customerRefreshSession.findMany({
        where: { customerId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
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
    return this.sessions
      .filter(
        (item) => item.customerId === customerId && !item.revokedAt && item.expiresAt > new Date(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((item) => ({
        id: item.id,
        userAgent: item.userAgent,
        ipAddress: item.ipAddress,
        createdAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
        current: item.id === currentSessionId,
      }));
  }
  async revokeById(customerId: string, id: string): Promise<boolean> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const result = await this.prisma.customerRefreshSession.updateMany({
        where: { id, customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count === 1;
    }
    const item = this.sessions.find(
      (session) => session.id === id && session.customerId === customerId && !session.revokedAt,
    );
    if (!item) return false;
    item.revokedAt = new Date();
    return true;
  }
  async revokeOthers(customerId: string, currentSessionId?: string): Promise<number> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const result = await this.prisma.customerRefreshSession.updateMany({
        where: {
          customerId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: new Date() },
      });
      return result.count;
    }
    let count = 0;
    for (const item of this.sessions)
      if (item.customerId === customerId && !item.revokedAt && item.id !== currentSessionId) {
        item.revokedAt = new Date();
        count += 1;
      }
    return count;
  }
}
