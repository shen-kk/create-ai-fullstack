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
});
