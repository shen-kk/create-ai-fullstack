import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthSession, AuthUser } from '@template/contracts';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginRateLimiter } from './login-rate-limiter.service.js';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

const cookieName = 'template_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly loginLimiter: LoginRateLimiter,
  ) {}
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const key = `${request.ip ?? 'unknown'}:${input.phone}`;
    this.loginLimiter.assertAllowed(key);
    try {
      const session = await this.auth.login(input.phone, input.password, this.metadata(request));
      this.loginLimiter.recordSuccess(key);
      return this.respond(session, response);
    } catch (error) {
      this.loginLimiter.recordFailure(key);
      throw error;
    }
  }
  @Post('refresh') @ApiCookieAuth(cookieName) async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    return this.respond(
      await this.auth.refresh(
        request.cookies?.[cookieName] as string | undefined,
        this.metadata(request),
      ),
      response,
    );
  }
  @Post('logout') @ApiCookieAuth(cookieName) async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[cookieName] as string | undefined);
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0`,
    );
  }
  @Get('me') @ApiBearerAuth() @UseGuards(AccessTokenGuard) me(
    @Req() request: Request & { user: AuthUser },
  ): AuthUser {
    return request.user;
  }
  @Patch('profile') @ApiBearerAuth() @UseGuards(AccessTokenGuard) updateProfile(
    @Body() input: UpdateProfileDto,
    @Req() request: Request & { user: AuthUser },
  ): Promise<AuthUser> {
    return this.auth.updateProfile(request.user.id, input.name, input.avatarUrl ?? null);
  }
  @Post('password') @HttpCode(204) @ApiBearerAuth() @UseGuards(AccessTokenGuard) changePassword(
    @Body() input: ChangePasswordDto,
    @Req() request: Request & { user: AuthUser },
  ): Promise<void> {
    return this.auth.changePassword(request.user.id, input.currentPassword, input.newPassword);
  }
  private respond(
    session: AuthSession & { refreshToken: string },
    response: Response,
  ): AuthSession {
    const { refreshToken, ...body } = session;
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=${refreshToken}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=604800${secure}`,
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
}
