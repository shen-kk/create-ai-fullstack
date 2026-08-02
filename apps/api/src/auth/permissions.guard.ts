import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@template/contracts';
import type { Request } from 'express';
import { requiredPermissionsKey } from './require-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(requiredPermissionsKey, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const granted = new Set(request.user?.permissions ?? []);
    if (!required.every((permission) => granted.has(permission)))
      throw new ForbiddenException('PERMISSION_DENIED');
    return true;
  }
}
