import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from './permissions.guard.js';

function contextWith(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => contextWith,
    getClass: () => PermissionsGuard,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: () => ['users.read'] } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  it('allows users with every required permission', () => {
    expect(guard.canActivate(contextWith(['users.read']))).toBe(true);
  });
  it('rejects users missing a required permission', () => {
    expect(() => guard.canActivate(contextWith([]))).toThrow('PERMISSION_DENIED');
  });
});
