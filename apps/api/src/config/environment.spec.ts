import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('accepts development defaults', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).not.toThrow();
  });
  it('rejects missing production secrets', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', API_PORT: '3001', DATA_SOURCE: 'prisma' }),
    ).toThrow('DATABASE_URL');
  });
  it('rejects an invalid port', () => {
    expect(() => validateEnvironment({ API_PORT: '70000' })).toThrow('API_PORT');
  });
  it('rejects an unsupported data source', () => {
    expect(() => validateEnvironment({ DATA_SOURCE: 'file' })).toThrow('DATA_SOURCE');
  });
  it('rejects the memory data source in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', DATA_SOURCE: 'memory' })).toThrow(
      'DATA_SOURCE must be prisma',
    );
  });
});
