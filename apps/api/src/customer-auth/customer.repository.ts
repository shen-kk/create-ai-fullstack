import { ConflictException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type {
  CustomerListQuery,
  CustomerListResponse,
  CustomerProfile,
  CustomerStatus,
  CustomerSummary,
} from '@template/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { verifyScryptPassword } from '../auth/password-hash.js';

interface CustomerRecord extends CustomerProfile {
  passwordHash: string;
  lastActiveAt: string | null;
}

@Injectable()
export class CustomerRepository {
  private readonly records = new Map<string, CustomerRecord>();

  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    phone: string;
    passwordHash: string;
    name: string;
    email: string | null;
  }): Promise<CustomerProfile> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const existing = await this.prisma.customer.findUnique({ where: { phone: input.phone } });
      if (existing) throw new ConflictException('CUSTOMER_PHONE_EXISTS');
      return this.toProfile(
        await this.prisma.customer.create({ data: { ...input, phoneVerifiedAt: new Date() } }),
      );
    }
    if ([...this.records.values()].some((item) => item.phone === input.phone))
      throw new ConflictException('CUSTOMER_PHONE_EXISTS');
    const record: CustomerRecord = {
      id: `cus_${randomUUID()}`,
      phone: input.phone,
      name: input.name,
      email: input.email,
      avatarUrl: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordHash: input.passwordHash,
      lastActiveAt: null,
      phoneVerifiedAt: new Date().toISOString(),
      emailVerifiedAt: null,
    };
    this.records.set(record.id, record);
    return this.publicRecord(record);
  }

  async authenticate(phone: string, password: string): Promise<CustomerProfile | null> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const record = await this.prisma.customer.findUnique({ where: { phone } });
      if (
        !record ||
        record.status !== UserStatus.ACTIVE ||
        !(await verifyScryptPassword(password, record.passwordHash))
      )
        return null;
      await this.prisma.customer.update({
        where: { id: record.id },
        data: { lastActiveAt: new Date() },
      });
      return this.toProfile(record);
    }
    const record = [...this.records.values()].find((item) => item.phone === phone);
    if (
      !record ||
      record.status !== 'active' ||
      !(await verifyScryptPassword(password, record.passwordHash))
    )
      return null;
    record.lastActiveAt = new Date().toISOString();
    return this.publicRecord(record);
  }

  async findActiveByPhone(phone: string): Promise<CustomerProfile | null> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const record = await this.prisma.customer.findFirst({
        where: { phone, status: UserStatus.ACTIVE },
      });
      return record ? this.toProfile(record) : null;
    }
    const record = [...this.records.values()].find(
      (item) => item.phone === phone && item.status === 'active',
    );
    return record ? this.publicRecord(record) : null;
  }

  async resetPassword(phone: string, passwordHash: string): Promise<boolean> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const result = await this.prisma.customer.updateMany({
        where: { phone, status: UserStatus.ACTIVE },
        data: { passwordHash },
      });
      return result.count > 0;
    }
    const record = [...this.records.values()].find(
      (item) => item.phone === phone && item.status === 'active',
    );
    if (!record) return false;
    record.passwordHash = passwordHash;
    return true;
  }

  async bindContact(
    id: string,
    channel: 'sms' | 'email',
    target: string,
  ): Promise<CustomerProfile | null> {
    const now = new Date();
    if (process.env.DATA_SOURCE === 'prisma') {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      if (!existing) return null;
      return this.toProfile(
        await this.prisma.customer.update({
          where: { id },
          data:
            channel === 'sms'
              ? { phone: target, phoneVerifiedAt: now }
              : { email: target.toLowerCase(), emailVerifiedAt: now },
        }),
      );
    }
    const record = this.records.get(id);
    if (!record) return null;
    if (channel === 'sms') {
      record.phone = target;
      record.phoneVerifiedAt = now.toISOString();
    } else {
      record.email = target.toLowerCase();
      record.emailVerifiedAt = now.toISOString();
    }
    return this.publicRecord(record);
  }

  async findActiveById(id: string): Promise<CustomerProfile | null> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const record = await this.prisma.customer.findFirst({
        where: { id, status: UserStatus.ACTIVE },
      });
      return record ? this.toProfile(record) : null;
    }
    const record = this.records.get(id);
    return record?.status === 'active' ? this.publicRecord(record) : null;
  }

  async update(
    id: string,
    input: { name: string; email: string | null; avatarUrl: string | null },
  ): Promise<CustomerProfile | null> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      return existing
        ? this.toProfile(await this.prisma.customer.update({ where: { id }, data: input }))
        : null;
    }
    const record = this.records.get(id);
    if (!record) return null;
    Object.assign(record, input);
    return this.publicRecord(record);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const record = await this.prisma.customer.findUnique({ where: { id } });
      if (!record || !(await verifyScryptPassword(currentPassword, record.passwordHash)))
        return false;
      await this.prisma.customer.update({ where: { id }, data: { passwordHash } });
      return true;
    }
    const record = this.records.get(id);
    if (!record || !(await verifyScryptPassword(currentPassword, record.passwordHash)))
      return false;
    record.passwordHash = passwordHash;
    return true;
  }

  async list(query: CustomerListQuery): Promise<CustomerListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    if (process.env.DATA_SOURCE === 'prisma') {
      const keyword = query.keyword?.trim();
      const where = {
        ...(query.status
          ? { status: query.status === 'active' ? UserStatus.ACTIVE : UserStatus.DISABLED }
          : {}),
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' as const } },
                { phone: { contains: keyword } },
                { email: { contains: keyword, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.customer.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.customer.count({ where }),
      ]);
      return { items: items.map((item) => this.toSummary(item)), page, pageSize, total };
    }
    const keyword = query.keyword?.trim().toLowerCase();
    const all = [...this.records.values()]
      .filter((item) => !query.status || item.status === query.status)
      .filter(
        (item) =>
          !keyword ||
          item.name.toLowerCase().includes(keyword) ||
          item.phone.includes(keyword) ||
          Boolean(item.email?.toLowerCase().includes(keyword)),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
      );
    return {
      items: all
        .slice((page - 1) * pageSize, page * pageSize)
        .map((item) => this.memorySummary(item)),
      page,
      pageSize,
      total: all.length,
    };
  }

  async changeStatus(id: string, status: CustomerStatus): Promise<CustomerSummary | null> {
    if (process.env.DATA_SOURCE === 'prisma') {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      if (!existing) return null;
      return this.toSummary(
        await this.prisma.customer.update({
          where: { id },
          data: { status: status === 'active' ? UserStatus.ACTIVE : UserStatus.DISABLED },
        }),
      );
    }
    const record = this.records.get(id);
    if (!record) return null;
    record.status = status;
    return this.memorySummary(record);
  }

  private publicRecord(record: CustomerRecord): CustomerProfile {
    return {
      id: record.id,
      phone: record.phone,
      name: record.name,
      email: record.email,
      avatarUrl: record.avatarUrl,
      status: record.status,
      createdAt: record.createdAt,
      phoneVerifiedAt: record.phoneVerifiedAt,
      emailVerifiedAt: record.emailVerifiedAt,
    };
  }
  private memorySummary(record: CustomerRecord): CustomerSummary {
    return { ...this.publicRecord(record), lastActiveAt: record.lastActiveAt };
  }
  private toSummary(record: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    status: UserStatus;
    createdAt: Date;
    lastActiveAt: Date | null;
    phoneVerifiedAt: Date | null;
    emailVerifiedAt: Date | null;
  }): CustomerSummary {
    return { ...this.toProfile(record), lastActiveAt: record.lastActiveAt?.toISOString() ?? null };
  }
  private toProfile(record: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    status: UserStatus;
    createdAt: Date;
    phoneVerifiedAt: Date | null;
    emailVerifiedAt: Date | null;
  }): CustomerProfile {
    return {
      id: record.id,
      phone: record.phone,
      name: record.name,
      email: record.email,
      avatarUrl: record.avatarUrl,
      status: record.status === UserStatus.ACTIVE ? 'active' : 'disabled',
      createdAt: record.createdAt.toISOString(),
      phoneVerifiedAt: record.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: record.emailVerifiedAt?.toISOString() ?? null,
    };
  }
}
