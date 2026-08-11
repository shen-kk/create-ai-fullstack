import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports a healthy API', () => {
    const result = new HealthController({} as never).getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('returns only non-sensitive runtime information', () => {
    const result = new HealthController({} as never).info();

    expect(result).toMatchObject({ service: 'api', dataSource: 'prisma' });
    expect(result.nodeVersion).toMatch(/^v\d+/);
    expect(result).not.toHaveProperty('databaseUrl');
    expect(result).not.toHaveProperty('jwtSecret');
  });
});
