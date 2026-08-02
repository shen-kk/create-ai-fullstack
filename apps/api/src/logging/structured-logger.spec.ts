import { describe, expect, it } from 'vitest';
import { createLogEntry } from './structured-logger.js';

describe('createLogEntry', () => {
  it('creates machine-readable log fields without request payloads', () => {
    const entry = createLogEntry('info', 'http.request.completed', 'HTTP', {
      requestId: 'req-1',
      method: 'POST',
      statusCode: 201,
    });
    expect(entry).toMatchObject({
      level: 'info',
      message: 'http.request.completed',
      context: 'HTTP',
      requestId: 'req-1',
      method: 'POST',
      statusCode: 201,
    });
    expect(JSON.stringify(entry)).not.toContain('password');
  });
  it('normalizes Error messages without exposing stacks by default', () => {
    expect(createLogEntry('error', new Error('DATABASE_UNAVAILABLE')).message).toBe(
      'DATABASE_UNAVAILABLE',
    );
  });
});
