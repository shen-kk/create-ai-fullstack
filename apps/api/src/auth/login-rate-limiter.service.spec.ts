import { describe, expect, it } from 'vitest';
import { LoginRateLimiter } from './login-rate-limiter.service.js';

describe('LoginRateLimiter', () => {
  it('blocks after five failed attempts in the window', () => {
    const limiter = new LoginRateLimiter();
    for (let index = 0; index < 5; index += 1) limiter.recordFailure('ip:user', 1000);
    expect(() => limiter.assertAllowed('ip:user', 1001)).toThrow('LOGIN_RATE_LIMITED');
  });

  it('clears failures after a successful login', () => {
    const limiter = new LoginRateLimiter();
    limiter.recordFailure('ip:user', 1000);
    limiter.recordSuccess('ip:user');
    expect(() => limiter.assertAllowed('ip:user', 1001)).not.toThrow();
  });
});
