import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CustomerProfile, CustomerSession } from '@template/contracts';
import { randomUUID } from 'node:crypto';
import { hashScryptPassword } from '../auth/password-hash.js';
import { hashRefreshToken } from '../auth/refresh-token-hash.js';
import { CustomerRepository } from './customer.repository.js';
import { CustomerSessionRepository } from './customer-session.repository.js';
import { VerificationService } from './verification.service.js';

const refreshLifetimeSeconds = 7 * 24 * 60 * 60;
interface CustomerToken {
  sub: string;
  audience: 'customer';
}

@Injectable()
export class CustomerAuthService {
  private readonly refreshSecret =
    process.env.CUSTOMER_JWT_REFRESH_SECRET ??
    process.env.JWT_REFRESH_SECRET ??
    'development-customer-refresh-secret';
  constructor(
    private readonly jwt: JwtService,
    private readonly customers: CustomerRepository,
    private readonly sessions: CustomerSessionRepository,
    private readonly verification: VerificationService,
  ) {}
  async register(
    input: {
      phone: string;
      password: string;
      name: string;
      email?: string;
      verificationCode: string;
    },
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomerSession & { refreshToken: string }> {
    await this.verification.consume('sms', input.phone, 'register', input.verificationCode);
    const customer = await this.customers.create({
      phone: input.phone.trim(),
      passwordHash: await hashScryptPassword(input.password),
      name: input.name.trim(),
      email: input.email?.trim() || null,
    });
    return this.issue(customer, metadata);
  }
  async loginWithCode(
    phone: string,
    code: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomerSession & { refreshToken: string }> {
    await this.verification.consume('sms', phone, 'login', code);
    const customer = await this.customers.findActiveByPhone(phone.trim());
    if (!customer) throw new UnauthorizedException('CUSTOMER_NOT_FOUND');
    return this.issue(customer, metadata);
  }
  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    await this.verification.consume('sms', phone, 'reset_password', code);
    if (!(await this.customers.resetPassword(phone.trim(), await hashScryptPassword(newPassword))))
      throw new NotFoundException('CUSTOMER_NOT_FOUND');
  }
  async bindContact(
    id: string,
    channel: 'sms' | 'email',
    target: string,
    code: string,
  ): Promise<CustomerProfile> {
    await this.verification.consume(channel, target, 'bind_contact', code);
    const customer = await this.customers.bindContact(id, channel, target.trim());
    if (!customer) throw new NotFoundException('CUSTOMER_NOT_FOUND');
    return customer;
  }
  async login(
    phone: string,
    password: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomerSession & { refreshToken: string }> {
    const customer = await this.customers.authenticate(phone.trim(), password);
    if (!customer) throw new UnauthorizedException('INVALID_CUSTOMER_CREDENTIALS');
    return this.issue(customer, metadata);
  }
  async refresh(
    token: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomerSession & { refreshToken: string }> {
    if (!token) throw new UnauthorizedException('CUSTOMER_REFRESH_TOKEN_REQUIRED');
    let payload: CustomerToken;
    try {
      payload = await this.jwt.verifyAsync<CustomerToken>(token, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('INVALID_CUSTOMER_REFRESH_TOKEN');
    }
    if (
      payload.audience !== 'customer' ||
      !(await this.sessions.consume(payload.sub, hashRefreshToken(token)))
    )
      throw new UnauthorizedException('INVALID_CUSTOMER_REFRESH_TOKEN');
    const customer = await this.customers.findActiveById(payload.sub);
    if (!customer) throw new UnauthorizedException('INVALID_CUSTOMER_REFRESH_TOKEN');
    return this.issue(customer, metadata);
  }
  async logout(token?: string): Promise<void> {
    if (token) await this.sessions.revoke(hashRefreshToken(token));
  }
  async verifyAccess(token: string): Promise<CustomerProfile & { sessionId: string }> {
    const payload = await this.jwt.verifyAsync<CustomerProfile & { audience: string; sid: string }>(
      token,
    );
    if (payload.audience !== 'customer' || !payload.sid)
      throw new UnauthorizedException('INVALID_CUSTOMER_ACCESS_TOKEN');
    const customer = await this.customers.findActiveById(payload.id);
    if (!customer) throw new UnauthorizedException('INVALID_CUSTOMER_ACCESS_TOKEN');
    return { ...customer, sessionId: payload.sid };
  }
  async update(
    id: string,
    input: { name: string; email?: string | null; avatarUrl?: string | null },
  ): Promise<CustomerProfile> {
    const current = await this.customers.findActiveById(id);
    if (!current) throw new NotFoundException('CUSTOMER_NOT_FOUND');
    const result = await this.customers.update(id, {
      name: input.name.trim(),
      email: current.email,
      avatarUrl: input.avatarUrl?.trim() || null,
    });
    if (!result) throw new NotFoundException('CUSTOMER_NOT_FOUND');
    return result;
  }
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    if (currentPassword === newPassword) throw new ConflictException('PASSWORD_UNCHANGED');
    if (
      !(await this.customers.changePassword(
        id,
        currentPassword,
        await hashScryptPassword(newPassword),
      ))
    )
      throw new UnauthorizedException('CURRENT_PASSWORD_INVALID');
  }
  private async issue(
    customer: CustomerProfile,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomerSession & { refreshToken: string }> {
    const refreshToken = await this.jwt.signAsync(
      { sub: customer.id, audience: 'customer', jti: randomUUID() },
      { secret: this.refreshSecret, expiresIn: refreshLifetimeSeconds },
    );
    const sessionId = await this.sessions.create(
      customer.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + refreshLifetimeSeconds * 1000),
      metadata,
    );
    const accessToken = await this.jwt.signAsync(
      { ...customer, audience: 'customer' as const, sid: sessionId },
      { expiresIn: '15m' },
    );
    return { accessToken, refreshToken, expiresIn: 900, customer };
  }
}
