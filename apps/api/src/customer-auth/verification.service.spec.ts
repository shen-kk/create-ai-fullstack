import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificationService } from './verification.service.js';

const createService = (): VerificationService =>
  new VerificationService(
    { verificationCode: { findFirst: () => Promise.resolve(null) } } as never,
    {
      assertCustomerAuthChannel: () => Promise.resolve(),
      getCustomerAuthSettings: () =>
        Promise.resolve({
          mode: 'phone',
          availableChannels: ['sms'],
          verificationTtlSeconds: 300,
          verificationRetrySeconds: 60,
          updatedAt: null,
        }),
      runtimeConfig: () => Promise.resolve({ enabled: false, values: {}, secrets: {} }),
    } as never,
  );

describe('VerificationService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an invalid phone before accessing persistence', async () => {
    await expect(createService().send('sms', '123', 'login')).rejects.toThrow('INVALID_PHONE');
  });

  it('requires a configured delivery provider', async () => {
    await expect(createService().send('email', 'user@example.com', 'bind_contact')).rejects.toThrow(
      'EMAIL_NOT_CONFIGURED',
    );
  });

  it('maps the reset-password purpose to the password-reset feature binding', async () => {
    const runtimeConfig = vi.fn().mockResolvedValue({ enabled: false, values: {}, secrets: {} });
    const service = new VerificationService(
      { verificationCode: { findFirst: () => Promise.resolve(null) } } as never,
      {
        assertCustomerAuthChannel: () => Promise.resolve(),
        getCustomerAuthSettings: () =>
          Promise.resolve({
            mode: 'email',
            availableChannels: ['email'],
            verificationTtlSeconds: 300,
            verificationRetrySeconds: 60,
            updatedAt: null,
          }),
        runtimeConfig,
      } as never,
    );

    await expect(service.send('email', 'user@example.com', 'reset_password')).rejects.toThrow(
      'EMAIL_NOT_CONFIGURED',
    );
    expect(runtimeConfig).toHaveBeenCalledWith('email', 'customer.email_password_reset');
  });

  it('delivers an email verification code through Tencent SES', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Response: { RequestId: 'request-id' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new VerificationService(
      {
        verificationCode: {
          findFirst: () => Promise.resolve(null),
          create: () => Promise.resolve(),
          update: () => Promise.resolve(),
        },
      } as never,
      {
        assertCustomerAuthChannel: () => Promise.resolve(),
        getCustomerAuthSettings: () =>
          Promise.resolve({
            mode: 'email',
            availableChannels: ['email'],
            verificationTtlSeconds: 420,
            verificationRetrySeconds: 90,
            updatedAt: null,
          }),
        runtimeConfig: () =>
          Promise.resolve({
            enabled: true,
            values: {
              provider: 'tencent_ses',
              region: 'ap-guangzhou',
              accessKeyId: 'secret-id',
              from: 'verify@example.com',
              templateId: '12345',
            },
            secrets: { accessKeySecret: 'secret-key' },
            template: {
              id: 'template-id',
              code: 'email_login',
              name: '登录验证码邮件',
              channel: 'email',
              subject: '{{projectName}} 验证码',
              textBody: '验证码 {{code}}',
              htmlBody: null,
              providerTemplateId: '12345',
              parameterMapping: { code: '{{code}}' },
              enabled: true,
              system: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
      } as never,
    );

    await expect(service.send('email', 'user@example.com', 'login')).resolves.toEqual({
      expiresIn: 420,
      retryAfter: 90,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, { body: string; headers: object }];
    expect(url).toBe('https://ses.tencentcloudapi.com');
    expect(request.headers).toMatchObject({ 'X-TC-Action': 'SendEmail' });
    expect(JSON.parse(request.body)).toMatchObject({
      FromEmailAddress: 'verify@example.com',
      Destination: ['user@example.com'],
      Template: { TemplateID: 12345 },
    });
  });

  it('does not rate-limit a retry after a failed delivery', async () => {
    type VerificationLookup = {
      where: { deliveryStatus?: { in: string[] } };
    };
    const findFirst = vi.fn<(input: VerificationLookup) => Promise<null>>().mockResolvedValue(null);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Response: { RequestId: 'request-id' } }),
      }),
    );
    const service = new VerificationService(
      {
        verificationCode: {
          findFirst,
          create: () => Promise.resolve(),
          update: () => Promise.resolve(),
        },
      } as never,
      {
        assertCustomerAuthChannel: () => Promise.resolve(),
        getCustomerAuthSettings: () =>
          Promise.resolve({
            mode: 'email',
            availableChannels: ['email'],
            verificationTtlSeconds: 300,
            verificationRetrySeconds: 60,
            updatedAt: null,
          }),
        runtimeConfig: () =>
          Promise.resolve({
            enabled: true,
            values: {
              provider: 'tencent_ses',
              region: 'ap-guangzhou',
              accessKeyId: 'secret-id',
              from: 'verify@example.com',
              templateId: '12345',
            },
            secrets: { accessKeySecret: 'secret-key' },
            template: {
              id: 'template-id',
              code: 'email_login',
              name: '登录验证码邮件',
              channel: 'email',
              subject: '{{projectName}} 验证码',
              textBody: '验证码 {{code}}',
              htmlBody: null,
              providerTemplateId: '12345',
              parameterMapping: { code: '{{code}}' },
              enabled: true,
              system: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
      } as never,
    );

    await service.send('email', 'user@example.com', 'login');
    expect(findFirst.mock.calls[0]?.[0].where.deliveryStatus).toEqual({
      in: ['pending', 'sent'],
    });
  });
});
