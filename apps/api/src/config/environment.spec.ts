import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('accepts development defaults', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://localhost/app' }),
    ).not.toThrow();
  });
  it('rejects missing production secrets', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', API_PORT: '3001' })).toThrow(
      'DATABASE_URL',
    );
  });
  it('rejects an invalid port', () => {
    expect(() => validateEnvironment({ API_PORT: '70000' })).toThrow('API_PORT');
  });
  it('requires a database URL in every environment', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow('DATABASE_URL');
  });
});
