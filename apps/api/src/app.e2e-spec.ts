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
});
