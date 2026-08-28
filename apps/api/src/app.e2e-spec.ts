import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type {
  CustomerAuthSetting,
  IntegrationConfig,
  Prisma,
  ServiceFeatureBinding,
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Admin API HTTP workflow', () => {
  const port = 31000 + (process.pid % 1000),
    baseUrl = `http://127.0.0.1:${port}/api`;
  const adminPhone = process.env.DEV_ADMIN_PHONE ?? '';
  const adminPassword = process.env.DEV_ADMIN_PASSWORD ?? '';
  const runSuffix = String(Date.now()).slice(-7);
  const firstCustomerPhone = `1390${runSuffix}`;
  const secondCustomerPhone = `1380${runSuffix}`;
  const firstCustomerEmail = `customer-${runSuffix}@example.com`;
  const secondCustomerEmail = `stable-customer-${runSuffix}@example.com`;
  let api: ChildProcess,
    accessToken = '';
  let previousSqlConfig: IntegrationConfig | null = null;
  let previousCustomerAuthSetting: CustomerAuthSetting | null = null;
  let previousCustomerAvatarBinding: ServiceFeatureBinding | null = null;
  const prisma = new PrismaClient();
  const issueCode = async (
    channel: 'sms' | 'email',
    target: string,
    purpose: 'register' | 'login' | 'reset_password' | 'bind_contact',
  ): Promise<string> => {
    const code = '123456';
    const normalized = target.trim().toLowerCase();
    await prisma.verificationCode.create({
      data: {
        id: randomUUID(),
        channel,
        targetHash: createHash('sha256').update(normalized).digest('hex'),
        targetMasked:
          channel === 'sms'
            ? `${normalized.slice(0, 3)}****${normalized.slice(-4)}`
            : 'e2***@example.com',
        purpose,
        codeHash: createHash('sha256').update(code).digest('hex'),
        expiresAt: new Date(Date.now() + 300_000),
        deliveryStatus: 'sent',
      },
    });
    return code;
  };

  beforeAll(async () => {
    if (!adminPhone || !adminPassword)
      throw new Error(
        'E2E requires DEV_ADMIN_PHONE and DEV_ADMIN_PASSWORD from the private environment',
      );
    previousCustomerAuthSetting = await prisma.customerAuthSetting.findUnique({
      where: { id: 1 },
    });
    previousCustomerAvatarBinding = await prisma.serviceFeatureBinding.findUnique({
      where: { code: 'customer.avatar_upload' },
    });
    await prisma.serviceFeatureBinding.deleteMany({
      where: { code: 'customer.avatar_upload' },
    });
    await prisma.customerAuthSetting.upsert({
      where: { id: 1 },
      create: { id: 1, mode: 'phone' },
      update: { mode: 'phone' },
    });
    api = spawn(process.execPath, ['dist/src/main.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        API_PORT: String(port),
      },
    });
    let lastError = '';
    api.stderr?.on('data', (chunk: Buffer) => {
      lastError += chunk.toString();
    });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (api.exitCode !== null) throw new Error(`API 提前退出：${lastError}`);
      try {
        const response = await fetch(`${baseUrl}/health/live`);
        if (response.ok) return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`API 启动超时：${lastError}`);
  });

  afterAll(async () => {
    if (api?.exitCode === null) {
      api.kill();
      await new Promise((resolve) => api.once('exit', resolve));
    }
    await prisma.customer.deleteMany({
      where: { phone: { in: [firstCustomerPhone, secondCustomerPhone] } },
    });
    await prisma.verificationCode.deleteMany({
      where: {
        targetHash: {
          in: [
            firstCustomerPhone,
            secondCustomerPhone,
            firstCustomerEmail,
            secondCustomerEmail,
          ].map((value) => createHash('sha256').update(value).digest('hex')),
        },
      },
    });
    if (previousSqlConfig) {
      const values = previousSqlConfig.values as Prisma.InputJsonValue;
      await prisma.integrationConfig.upsert({
        where: { kind: 'sql' },
        create: {
          id: previousSqlConfig.id,
          kind: previousSqlConfig.kind,
          enabled: previousSqlConfig.enabled,
          values,
          encryptedSecrets: previousSqlConfig.encryptedSecrets,
          createdAt: previousSqlConfig.createdAt,
          updatedAt: previousSqlConfig.updatedAt,
        },
        update: {
          enabled: previousSqlConfig.enabled,
          values,
          encryptedSecrets: previousSqlConfig.encryptedSecrets,
        },
      });
    }
    if (previousCustomerAuthSetting) {
      await prisma.customerAuthSetting.upsert({
        where: { id: 1 },
        create: previousCustomerAuthSetting,
        update: previousCustomerAuthSetting,
      });
    } else {
      await prisma.customerAuthSetting.deleteMany({ where: { id: 1 } });
    }
    if (previousCustomerAvatarBinding) {
      await prisma.serviceFeatureBinding.upsert({
        where: { code: previousCustomerAvatarBinding.code },
        create: previousCustomerAvatarBinding,
        update: {
          resourceId: previousCustomerAvatarBinding.resourceId,
          templateId: previousCustomerAvatarBinding.templateId,
        },
      });
    }
    await prisma.$disconnect();
  });

  it('logs in with the phone identity and accesses a protected resource', async () => {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: adminPhone, password: adminPassword }),
    });
    expect(login.status).toBe(200);
    const session = (await login.json()) as { accessToken: string; user: { phone: string } };
    expect(session.user.phone).toBe(adminPhone);
    accessToken = session.accessToken;
    const users = await fetch(`${baseUrl}/users`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(users.status).toBe(200);
  });

  it('lists administrator devices and revokes every other session', async () => {
    const previousAccessToken = accessToken;
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'E2E second admin device' },
      body: JSON.stringify({ phone: adminPhone, password: adminPassword }),
    });
    expect(login.status).toBe(200);
    const current = (await login.json()) as { accessToken: string };
    accessToken = current.accessToken;

    const sessions = await fetch(`${baseUrl}/auth/sessions`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(sessions.status).toBe(200);
    const devices = (await sessions.json()) as Array<{ current: boolean }>;
    expect(devices.length).toBeGreaterThanOrEqual(2);
    expect(devices.filter((device) => device.current)).toHaveLength(1);

    const revokeOthers = await fetch(`${baseUrl}/auth/sessions/others`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(revokeOthers.status).toBe(204);
    const revokedDevice = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${previousAccessToken}` },
    });
    expect(revokedDevice.status).toBe(401);
    const currentDevice = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(currentDevice.status).toBe(200);
  });

  it('rejects incomplete service configuration and exposes a secret-free audit record', async () => {
    previousSqlConfig = await prisma.integrationConfig.findUnique({ where: { kind: 'sql' } });
    await prisma.integrationConfig.deleteMany({ where: { kind: 'sql' } });
    const update = await fetch(`${baseUrl}/integrations/sql`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        values: { engine: 'postgresql' },
        secrets: { password: 'must-not-appear' },
      }),
    });
    expect(update.status).toBe(400);
    expect(await update.json()).toMatchObject({ code: 'INTEGRATION_REQUIRED_FIELD_MISSING' });
    const logs = await fetch(`${baseUrl}/audit-logs?action=integration.update`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logs.status).toBe(200);
    const payload = await logs.text();
    expect(payload).toContain('integration.update');
    expect(payload).not.toContain('must-not-appear');
  });

  it('creates an isolated customer on first code login, accesses profile and rotates the session', async () => {
    const verificationCode = await issueCode('sms', firstCustomerPhone, 'login');
    const register = await fetch(`${baseUrl}/customer-auth/login/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'sms',
        identifier: firstCustomerPhone,
        code: verificationCode,
      }),
    });
    expect(register.status).toBe(201);
    const cookie = register.headers.get('set-cookie');
    expect(cookie).toContain('customer_refresh=');
    const session = (await register.json()) as {
      accessToken: string;
      customer: { phone: string; status: string };
    };
    expect(session.customer).toMatchObject({ phone: firstCustomerPhone, status: 'active' });

    const profile = await fetch(`${baseUrl}/customer-auth/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(profile.status).toBe(200);

    const refresh = await fetch(`${baseUrl}/customer-auth/refresh`, {
      method: 'POST',
      headers: { cookie: cookie?.split(';')[0] ?? '' },
    });
    expect(refresh.status).toBe(201);
    expect(refresh.headers.get('set-cookie')).toContain('customer_refresh=');

    const customers = await fetch(`${baseUrl}/customers?keyword=${firstCustomerPhone}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(customers.status).toBe(200);
    const customerList = (await customers.json()) as { items: Array<{ id: string }> };
    expect(customerList.items).toHaveLength(1);
    const disable = await fetch(
      `${baseUrl}/customers/${encodeURIComponent(customerList.items[0]?.id ?? '')}/status`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'disabled' }),
      },
    );
    expect(disable.status).toBe(200);
    const rejected = await fetch(`${baseUrl}/customer-auth/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(rejected.status).toBe(401);
  });

  it('supports the complete customer account and device lifecycle', async () => {
    const phone = secondCustomerPhone;
    const registerCode = await issueCode('sms', phone, 'login');
    const register = await fetch(`${baseUrl}/customer-auth/login/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'e2e-primary-device' },
      body: JSON.stringify({
        channel: 'sms',
        identifier: phone,
        code: registerCode,
      }),
    });
    expect(register.status).toBe(201);
    const primary = (await register.json()) as {
      accessToken: string;
      customer: { name: string; email: string | null; passwordConfigured: boolean };
    };
    expect(primary.customer.passwordConfigured).toBe(false);
    const initialPassword = await fetch(`${baseUrl}/customer-auth/password`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${primary.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: 'Customer@123',
      }),
    });
    expect(initialPassword.status).toBe(204);
    const configuredProfile = await fetch(`${baseUrl}/customer-auth/me`, {
      headers: { authorization: `Bearer ${primary.accessToken}` },
    });
    expect(configuredProfile.status).toBe(200);
    expect(await configuredProfile.json()).toMatchObject({ passwordConfigured: true });

    const missingCurrentPassword = await fetch(`${baseUrl}/customer-auth/password`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${primary.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ newPassword: 'Customer@456' }),
    });
    expect(missingCurrentPassword.status).toBe(401);

    const avatarBody = new FormData();
    avatarBody.append('file', new Blob(['avatar'], { type: 'image/png' }), 'avatar.png');
    const avatar = await fetch(`${baseUrl}/customer-auth/avatar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${primary.accessToken}` },
      body: avatarBody,
    });
    const avatarPayload = (await avatar.json()) as { code?: string; message?: string };
    expect(avatar.status, JSON.stringify(avatarPayload)).toBe(503);
    expect(avatarPayload).toMatchObject({ code: 'OBJECT_STORAGE_NOT_CONFIGURED' });

    const update = await fetch(`${baseUrl}/customer-auth/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${primary.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '稳定版用户已更新' }),
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toMatchObject({ name: '稳定版用户已更新' });

    const email = secondCustomerEmail;
    const bindCode = await issueCode('email', email, 'bind_contact');
    const bind = await fetch(`${baseUrl}/customer-auth/contact/bind`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${primary.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ channel: 'email', target: email, code: bindCode }),
    });
    expect(bind.status).toBe(201);
    expect(await bind.json()).toMatchObject({ email });

    const loginCode = await issueCode('sms', phone, 'login');
    const secondaryLogin = await fetch(`${baseUrl}/customer-auth/login/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'e2e-secondary-device' },
      body: JSON.stringify({ channel: 'sms', identifier: phone, code: loginCode }),
    });
    expect(secondaryLogin.status).toBe(201);
    const secondary = (await secondaryLogin.json()) as { accessToken: string };

    const sessions = await fetch(`${baseUrl}/customer-auth/sessions`, {
      headers: { authorization: `Bearer ${primary.accessToken}` },
    });
    expect(sessions.status).toBe(200);
    const devices = (await sessions.json()) as Array<{ id: string; current: boolean }>;
    expect(devices).toHaveLength(2);
    expect(devices.filter((device) => device.current)).toHaveLength(1);

    const revokeOthers = await fetch(`${baseUrl}/customer-auth/sessions/others`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${primary.accessToken}` },
    });
    expect(revokeOthers.status).toBe(204);
    const secondaryRejected = await fetch(`${baseUrl}/customer-auth/me`, {
      headers: { authorization: `Bearer ${secondary.accessToken}` },
    });
    expect(secondaryRejected.status).toBe(401);

    const passwordChange = await fetch(`${baseUrl}/customer-auth/password`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${primary.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'Customer@123',
        newPassword: 'Customer@456',
      }),
    });
    expect(passwordChange.status).toBe(204);

    const resetCode = await issueCode('sms', phone, 'reset_password');
    const reset = await fetch(`${baseUrl}/customer-auth/password/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'sms',
        identifier: phone,
        code: resetCode,
        newPassword: 'Customer@789',
      }),
    });
    expect(reset.status).toBe(204);
    const passwordLogin = await fetch(`${baseUrl}/customer-auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'sms', identifier: phone, password: 'Customer@789' }),
    });
    expect(passwordLogin.status).toBe(201);

    const logoutCookie = passwordLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
    const logout = await fetch(`${baseUrl}/customer-auth/logout`, {
      method: 'POST',
      headers: { cookie: logoutCookie },
    });
    expect(logout.status).toBe(204);
  });
});
