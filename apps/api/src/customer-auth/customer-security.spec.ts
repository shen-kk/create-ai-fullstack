import { createHash } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { LoginRateLimiter } from '../auth/login-rate-limiter.service.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerLoginDto, UpdateCustomerProfileDto } from './dto/customer.dto.js';
import { VerificationService } from './verification.service.js';
import { CustomerRepository } from './customer.repository.js';

describe('customer security boundaries', () => {
  it('revokes existing sessions in the password reset transaction', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer' }), updateMany },
      customerRefreshSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const repository = new CustomerRepository({
      customer: tx.customer,
      $transaction: async (run: (client: typeof tx) => Promise<boolean>) => run(tx),
    } as never);
    await expect(repository.resetPassword('email', 'user@example.com', 'new-hash')).resolves.toBe(
      true,
    );
    expect(tx.customerRefreshSession.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'customer', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
    updateMany.mockResolvedValueOnce({ count: 0 });
    tx.customerRefreshSession.updateMany.mockClear();
    await expect(repository.resetPassword('email', 'user@example.com', 'new-hash')).resolves.toBe(
      false,
    );
    expect(tx.customerRefreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('shares the login limit across whitespace and email case variants', () => {
    const limiter = new LoginRateLimiter();
    for (const identifier of [
      'User@example.com',
      ' user@example.com ',
      'USER@example.com',
      'user@example.com ',
      ' user@example.com',
    ]) {
      const input = plainToInstance(CustomerLoginDto, { channel: 'email', identifier });
      limiter.recordFailure(input.identifier);
    }
    expect(() => limiter.assertAllowed('user@example.com')).toThrow('LOGIN_RATE_LIMITED');
  });

  it('rejects direct avatar URLs at the public profile boundary', async () => {
    const input = plainToInstance(UpdateCustomerProfileDto, {
      name: 'User',
      avatarUrl: 'https://example.com/avatar.png',
    });
    const errors = await validate(input, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((error) => error.property === 'avatarUrl')).toBe(true);
  });

  it('keeps the uploaded avatar when updating only the name', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'customer' });
    const service = new CustomerAuthService(
      {} as never,
      {
        findActiveById: () =>
          Promise.resolve({ email: null, avatarUrl: 'https://example.com/upload.png' }),
        update,
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.update('customer', { name: 'User' });
    expect(update).toHaveBeenCalledWith(
      'customer',
      expect.objectContaining({ avatarUrl: 'https://example.com/upload.png' }),
    );
  });

  it.each([
    { attempts: 0, codes: ['123456', '123456'], successes: 1 },
    { attempts: 4, codes: ['123456', '123456'], successes: 1 },
    { attempts: 4, codes: ['000000', '123456'], successes: 0 },
  ])(
    'enforces atomic consumption and the attempt ceiling: $attempts / $codes',
    async ({ attempts, codes, successes }) => {
      const record = {
        id: 'code',
        attempts,
        consumedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 60000),
        codeHash: createHash('sha256').update('123456').digest('hex'),
      };
      const delegate = {
        findFirst: () => Promise.resolve({ ...record }),
        updateMany: ({
          where,
          data,
        }: {
          where: { consumedAt: null; attempts: { lt: number }; expiresAt: { gt: Date } };
          data: { consumedAt?: Date; attempts?: { increment: number } };
        }) => {
          if (
            record.consumedAt !== where.consumedAt ||
            record.attempts >= where.attempts.lt ||
            record.expiresAt <= where.expiresAt.gt
          )
            return Promise.resolve({ count: 0 });
          if (data.consumedAt) record.consumedAt = data.consumedAt;
          if (data.attempts) record.attempts += data.attempts.increment;
          return Promise.resolve({ count: 1 });
        },
      };
      const service = new VerificationService({ verificationCode: delegate } as never, {} as never);
      const results = await Promise.allSettled(
        codes.map((code) => service.consume('sms', '13800000000', 'login', code)),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(successes);
      expect(record.attempts).toBeLessThanOrEqual(5);
    },
  );
});
