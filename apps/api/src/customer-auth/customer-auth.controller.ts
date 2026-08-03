import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { CustomerProfile, CustomerSession } from '@template/contracts';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { LoginRateLimiter } from '../auth/login-rate-limiter.service.js';
import { CustomerAccessGuard } from './customer-access.guard.js';
import { CustomerAuthService } from './customer-auth.service.js';
import {
  BindCustomerContactDto,
  ChangeCustomerPasswordDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  ResetCustomerPasswordDto,
  SendVerificationCodeDto,
  UpdateCustomerProfileDto,
  VerificationCodeLoginDto,
} from './dto/customer.dto.js';
import { VerificationService } from './verification.service.js';
import type { SendVerificationCodeResponse } from '@template/contracts';

const cookieName = 'customer_refresh';

@ApiTags('customer-auth')
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly audit: AuditService,
    private readonly loginLimiter: LoginRateLimiter,
    private readonly verification: VerificationService,
  ) {}
  @Post('verification/send') @HttpCode(200) sendVerification(
    @Body() input: SendVerificationCodeDto,
  ): Promise<SendVerificationCodeResponse> {
    return this.verification.send(input.channel, input.target, input.purpose);
  }
  @Post('register') async register(
    @Body() input: CustomerRegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    const session = await this.respond(this.auth.register(input, this.metadata(request)), response);
    await this.audit.record({
      action: 'customer.register',
      resource: 'customer',
      resourceId: session.customer.id,
      result: 'success',
      ...this.auditMetadata(request),
    });
    return session;
  }
  @Post('login') async login(
    @Body() input: CustomerLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    const key = `customer:${request.ip ?? 'unknown'}:${input.phone}`;
    this.loginLimiter.assertAllowed(key);
    try {
      const session = await this.respond(
        this.auth.login(input.phone, input.password, this.metadata(request)),
        response,
      );
      this.loginLimiter.recordSuccess(key);
      return session;
    } catch (error) {
      this.loginLimiter.recordFailure(key);
      throw error;
    }
  }
  @Post('login/code') async loginWithCode(
    @Body() input: VerificationCodeLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    return this.respond(
      this.auth.loginWithCode(input.phone, input.code, this.metadata(request)),
      response,
    );
  }
  @Post('password/reset') @HttpCode(204) resetPassword(
    @Body() input: ResetCustomerPasswordDto,
  ): Promise<void> {
    return this.auth.resetPassword(input.phone, input.code, input.newPassword);
  }
  @Post('refresh') @ApiCookieAuth(cookieName) refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    return this.respond(
      this.auth.refresh(
        request.cookies?.[cookieName] as string | undefined,
        this.metadata(request),
      ),
      response,
    );
  }
  @Post('logout') @HttpCode(204) @ApiCookieAuth(cookieName) async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[cookieName] as string | undefined);
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=; HttpOnly; SameSite=Lax; Path=/api/customer-auth; Max-Age=0`,
    );
  }
  @Get('me') @ApiBearerAuth() @UseGuards(CustomerAccessGuard) me(
    @Req() request: Request & { customer: CustomerProfile },
  ): CustomerProfile {
    return request.customer;
  }
  @Patch('profile') @ApiBearerAuth() @UseGuards(CustomerAccessGuard) async update(
    @Body() input: UpdateCustomerProfileDto,
    @Req() request: Request & { customer: CustomerProfile },
  ): Promise<CustomerProfile> {
    const customer = await this.auth.update(request.customer.id, input);
    await this.audit.record({
      action: 'customer.profile.update',
      resource: 'customer',
      resourceId: customer.id,
      result: 'success',
      ...this.auditMetadata(request),
    });
    return customer;
  }
  @Post('password')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(CustomerAccessGuard)
  async changePassword(
    @Body() input: ChangeCustomerPasswordDto,
    @Req() request: Request & { customer: CustomerProfile },
  ): Promise<void> {
    await this.auth.changePassword(request.customer.id, input.currentPassword, input.newPassword);
    await this.audit.record({
      action: 'customer.password.change',
      resource: 'customer',
      resourceId: request.customer.id,
      result: 'success',
      ...this.auditMetadata(request),
    });
  }
  @Post('contact/bind') @ApiBearerAuth() @UseGuards(CustomerAccessGuard) bindContact(
    @Body() input: BindCustomerContactDto,
    @Req() request: Request & { customer: CustomerProfile },
  ): Promise<CustomerProfile> {
    return this.auth.bindContact(request.customer.id, input.channel, input.target, input.code);
  }
  private async respond(
    result: Promise<CustomerSession & { refreshToken: string }>,
    response: Response,
  ): Promise<CustomerSession> {
    const { refreshToken, ...body } = await result;
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=${refreshToken}; HttpOnly; SameSite=Lax; Path=/api/customer-auth; Max-Age=604800${secure}`,
    );
    return body;
  }
  private metadata(request: Request): { ipAddress?: string; userAgent?: string } {
    const userAgent = request.get('user-agent');
    return {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  }
  private auditMetadata(request: Request): { requestId?: string; ipAddress?: string } {
    const requestId = request.headers['x-request-id'];
    return {
      ...(typeof requestId === 'string' ? { requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    };
  }
}
