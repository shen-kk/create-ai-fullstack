import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface AttemptState {
  failures: number;
  resetAt: number;
}

@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxFailures = 5;

  assertAllowed(key: string, now = Date.now()): void {
    const state = this.attempts.get(key);
    if (!state || state.resetAt <= now) {
      this.attempts.delete(key);
      return;
    }
    if (state.failures >= this.maxFailures)
      throw new HttpException('LOGIN_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
  }

  recordFailure(key: string, now = Date.now()): void {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now)
      this.attempts.set(key, { failures: 1, resetAt: now + this.windowMs });
    else current.failures += 1;
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }
}
