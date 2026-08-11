import { describe, expect, it } from 'vitest';
import { VerificationService } from './verification.service.js';

const createService = (): VerificationService =>
  new VerificationService(
    { verificationCode: { findFirst: () => Promise.resolve(null) } } as never,
    {
      runtimeConfig: () => Promise.resolve({ enabled: false, values: {}, secrets: {} }),
    } as never,
  );

describe('VerificationService', () => {
  it('rejects an invalid phone before accessing persistence', async () => {
    await expect(createService().send('sms', '123', 'register')).rejects.toThrow('INVALID_PHONE');
  });

  it('requires a configured delivery provider', async () => {
    await expect(createService().send('email', 'user@example.com', 'bind_contact')).rejects.toThrow(
      'EMAIL_NOT_CONFIGURED',
    );
  });
});
