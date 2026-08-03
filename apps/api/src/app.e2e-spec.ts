import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Admin API HTTP workflow', () => {
  const port = 31000 + (process.pid % 1000),
    baseUrl = `http://127.0.0.1:${port}/api`;
  let api: ChildProcess,
    accessToken = '';

  beforeAll(async () => {
    api = spawn(process.execPath, ['dist/src/main.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATA_SOURCE: process.env.E2E_DATA_SOURCE ?? 'memory',
        API_PORT: String(port),
        DEV_ADMIN_PHONE: '13800000000',
        DEV_ADMIN_PASSWORD: 'Admin@123456',
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
  });

  it('logs in with the phone identity and accesses a protected resource', async () => {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '13800000000', password: 'Admin@123456' }),
    });
    expect(login.status).toBe(201);
    const session = (await login.json()) as { accessToken: string; user: { phone: string } };
    expect(session.user.phone).toBe('13800000000');
    accessToken = session.accessToken;
    const users = await fetch(`${baseUrl}/users`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(users.status).toBe(200);
  });

  it('rejects incomplete service configuration and exposes a secret-free audit record', async () => {
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

  it('registers an isolated customer, accesses profile and rotates the customer session', async () => {
    const verification = await fetch(`${baseUrl}/customer-auth/verification/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'sms', target: '13900000001', purpose: 'register' }),
    });
    expect(verification.status).toBe(200);
    const verificationPayload = (await verification.json()) as { developmentCode: string };
    const register = await fetch(`${baseUrl}/customer-auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone: '13900000001',
        password: 'Customer@123',
        name: '体验用户',
        email: 'customer@example.com',
        verificationCode: verificationPayload.developmentCode,
      }),
    });
    expect(register.status).toBe(201);
    const cookie = register.headers.get('set-cookie');
    expect(cookie).toContain('customer_refresh=');
    const session = (await register.json()) as {
      accessToken: string;
      customer: { phone: string; status: string };
    };
    expect(session.customer).toMatchObject({ phone: '13900000001', status: 'active' });

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

    const customers = await fetch(`${baseUrl}/customers?keyword=13900000001`, {
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
    const phone = '13900000002';
    const sendCode = async (
      channel: 'sms' | 'email',
      target: string,
      purpose: 'register' | 'login' | 'reset_password' | 'bind_contact',
    ): Promise<string> => {
      const response = await fetch(`${baseUrl}/customer-auth/verification/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, target, purpose }),
      });
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { developmentCode?: string };
      expect(payload.developmentCode).toMatch(/^\d{6}$/);
      return payload.developmentCode ?? '';
    };
    const registerCode = await sendCode('sms', phone, 'register');
    const register = await fetch(`${baseUrl}/customer-auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'e2e-primary-device' },
      body: JSON.stringify({
        phone,
        password: 'Customer@123',
        name: '稳定版用户',
        verificationCode: registerCode,
      }),
    });
    expect(register.status).toBe(201);
    const primary = (await register.json()) as {
      accessToken: string;
      customer: { name: string; email: string | null };
    };

    const avatarBody = new FormData();
    avatarBody.append('file', new Blob(['avatar'], { type: 'image/png' }), 'avatar.png');
    const avatar = await fetch(`${baseUrl}/customer-auth/avatar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${primary.accessToken}` },
      body: avatarBody,
    });
    expect(avatar.status).toBe(503);
    expect(await avatar.json()).toMatchObject({ code: 'OBJECT_STORAGE_NOT_CONFIGURED' });

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

    const email = 'stable-customer@example.com';
    const bindCode = await sendCode('email', email, 'bind_contact');
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

    const loginCode = await sendCode('sms', phone, 'login');
    const secondaryLogin = await fetch(`${baseUrl}/customer-auth/login/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'e2e-secondary-device' },
      body: JSON.stringify({ phone, code: loginCode }),
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

    const resetCode = await sendCode('sms', phone, 'reset_password');
    const reset = await fetch(`${baseUrl}/customer-auth/password/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code: resetCode, newPassword: 'Customer@789' }),
    });
    expect(reset.status).toBe(204);
    const passwordLogin = await fetch(`${baseUrl}/customer-auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, password: 'Customer@789' }),
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
