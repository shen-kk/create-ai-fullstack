import { Injectable } from '@nestjs/common';
import type { CustomerSessionDevice } from '@template/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class CustomerSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<string> {
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

  async consume(customerId: string, tokenHash: string): Promise<boolean> {
    const result = await this.prisma.customerRefreshSession.updateMany({
      where: { customerId, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.prisma.customerRefreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async isActive(customerId: string, id: string): Promise<boolean> {
    return (
      (await this.prisma.customerRefreshSession.count({
        where: { id, customerId, revokedAt: null, expiresAt: { gt: new Date() } },
      })) === 1
    );
  }

  async revokeAll(customerId: string): Promise<void> {
    await this.prisma.customerRefreshSession.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async list(customerId: string, currentSessionId?: string): Promise<CustomerSessionDevice[]> {
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

  async revokeById(customerId: string, id: string): Promise<boolean> {
    const result = await this.prisma.customerRefreshSession.updateMany({
      where: { id, customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeOthers(customerId: string, currentSessionId?: string): Promise<number> {
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
}
