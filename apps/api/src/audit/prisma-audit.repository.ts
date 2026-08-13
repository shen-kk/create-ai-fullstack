import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditLogListResponse } from '@template/contracts';
import type { AuditEvent, AuditRepository } from './audit.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}
  async record(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: event.action,
        resource: event.resource,
        result: event.result,
        ...(event.actorId ? { actor: { connect: { id: event.actorId } } } : {}),
        ...(event.resourceId ? { resourceId: event.resourceId } : {}),
        ...(event.requestId ? { requestId: event.requestId } : {}),
        ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
        ...(event.metadata ? { metadata: event.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }
  async list(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    const keyword = query.keyword?.trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(keyword
        ? {
            OR: [
              { actorId: { contains: keyword, mode: 'insensitive' } },
              { resourceId: { contains: keyword, mode: 'insensitive' } },
              { requestId: { contains: keyword, mode: 'insensitive' } },
              { ipAddress: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { actor: { select: { name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        actorId: item.actorId,
        actorName: item.actor?.name ?? null,
        action: item.action,
        resource: item.resource,
        resourceId: item.resourceId,
        result: item.result,
        requestId: item.requestId,
        ipAddress: item.ipAddress,
        metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {},
        createdAt: item.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
