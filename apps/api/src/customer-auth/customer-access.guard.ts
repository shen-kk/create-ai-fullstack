import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CustomerProfile } from '@template/contracts';
import type { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service.js';

@Injectable()
export class CustomerAccessGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { customer: CustomerProfile & { sessionId: string } }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token)
      throw new UnauthorizedException('CUSTOMER_ACCESS_TOKEN_REQUIRED');
    try {
      request.customer = await this.auth.verifyAccess(token);
      return true;
    } catch {
      throw new UnauthorizedException('INVALID_CUSTOMER_ACCESS_TOKEN');
    }
  }
}
