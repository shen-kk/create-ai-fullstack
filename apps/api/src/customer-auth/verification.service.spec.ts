import { describe, expect, it } from 'vitest';
import { VerificationService } from './verification.service.js';

const createService = (): VerificationService =>
  new VerificationService(
    {} as never,
    { runtimeConfig: async () => ({ enabled: false, values: {}, secrets: {} }) } as never,
  );

describe('VerificationService', () => {
  it('issues a development code and consumes it only once', async () => {
    const service = createService();
    const result = await service.send('sms', '13900000021', 'register');
    expect(result.developmentCode).toMatch(/^\d{6}$/);
    await service.consume('sms', '13900000021', 'register', result.developmentCode ?? '');
    await expect(
      service.consume('sms', '13900000021', 'register', result.developmentCode ?? ''),
    ).rejects.toThrow('VERIFICATION_CODE_INVALID');
  });
  it('rate limits repeated sends for the same target and purpose', async () => {
    const service = createService();
    await service.send('email', 'verify-one@example.com', 'bind_contact');
    await expect(service.send('email', 'verify-one@example.com', 'bind_contact')).rejects.toThrow(
      'VERIFICATION_RETRY_LATER',
    );
  });
});
