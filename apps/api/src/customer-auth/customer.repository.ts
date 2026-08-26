import { ConflictException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type {
  CustomerListQuery,
  CustomerListResponse,
  CustomerProfile,
  CustomerStatus,
  CustomerSummary,
} from '@template/contracts';
import { PrismaService } from '../database/prisma.service.js';
import { verifyScryptPassword } from '../auth/password-hash.js';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    phone: string | null;
    passwordHash: string;
    name: string;
    email: string | null;
  }): Promise<CustomerProfile> {
    const existing = input.phone
      ? await this.prisma.customer.findUnique({ where: { phone: input.phone } })
      : input.email
        ? await this.prisma.customer.findUnique({ where: { email: input.email } })
        : null;
    if (existing) throw new ConflictException('CUSTOMER_IDENTIFIER_EXISTS');
    return this.toProfile(
      await this.prisma.customer.create({
        data: {
          ...input,
          phoneVerifiedAt: input.phone ? new Date() : null,
          emailVerifiedAt: input.email ? new Date() : null,
        },
      }),
    );
  }

  async authenticate(
    channel: 'sms' | 'email',
    identifier: string,
    password: string,
  ): Promise<CustomerProfile | null> {
    const record = await this.prisma.customer.findUnique({
      where: channel === 'sms' ? { phone: identifier } : { email: identifier },
    });
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

  async findActiveByIdentifier(
    channel: 'sms' | 'email',
    identifier: string,
  ): Promise<CustomerProfile | null> {
    const record = await this.prisma.customer.findFirst({
      where: {
        ...(channel === 'sms' ? { phone: identifier } : { email: identifier }),
        status: UserStatus.ACTIVE,
      },
    });
    return record ? this.toProfile(record) : null;
  }

  async resetPassword(
    channel: 'sms' | 'email',
    identifier: string,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.customer.updateMany({
      where: {
        ...(channel === 'sms' ? { phone: identifier } : { email: identifier }),
        status: UserStatus.ACTIVE,
      },
      data: { passwordHash },
    });
    return result.count > 0;
  }

  async bindContact(
    id: string,
    channel: 'sms' | 'email',
    target: string,
  ): Promise<CustomerProfile | null> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) return null;
    const now = new Date();
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

  async findActiveById(id: string): Promise<CustomerProfile | null> {
    const record = await this.prisma.customer.findFirst({
      where: { id, status: UserStatus.ACTIVE },
    });
    return record ? this.toProfile(record) : null;
  }

  async update(
    id: string,
    input: { name: string; email: string | null; avatarUrl: string | null },
  ): Promise<CustomerProfile | null> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    return existing
      ? this.toProfile(await this.prisma.customer.update({ where: { id }, data: input }))
      : null;
  }

  async changePassword(
    id: string,
    currentPassword: string | undefined,
    passwordHash: string,
  ): Promise<boolean> {
    const record = await this.prisma.customer.findUnique({ where: { id } });
    if (!record) return false;
    if (
      record.passwordConfiguredAt &&
      (!currentPassword || !(await verifyScryptPassword(currentPassword, record.passwordHash)))
    )
      return false;
    await this.prisma.customer.update({
      where: { id },
      data: { passwordHash, passwordConfiguredAt: new Date() },
    });
    return true;
  }

  async list(query: CustomerListQuery): Promise<CustomerListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
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

  async changeStatus(id: string, status: CustomerStatus): Promise<CustomerSummary | null> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) return null;
    return this.toSummary(
      await this.prisma.customer.update({
        where: { id },
        data: { status: status === 'active' ? UserStatus.ACTIVE : UserStatus.DISABLED },
      }),
    );
  }

  private toSummary(
    record: Parameters<CustomerRepository['toProfile']>[0] & { lastActiveAt: Date | null },
  ): CustomerSummary {
    return { ...this.toProfile(record), lastActiveAt: record.lastActiveAt?.toISOString() ?? null };
  }

  private toProfile(record: {
    id: string;
    phone: string | null;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    status: UserStatus;
    createdAt: Date;
    phoneVerifiedAt: Date | null;
    emailVerifiedAt: Date | null;
    passwordConfiguredAt: Date | null;
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
      passwordConfigured: Boolean(record.passwordConfiguredAt),
    };
  }
}
