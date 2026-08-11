import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimiter } from './login-rate-limiter.service.js';
import { PermissionsGuard } from './permissions.guard.js';
import { authIdentityRepositoryToken } from './auth-identity.repository.js';
import { PrismaAuthIdentityRepository } from './prisma-auth-identity.repository.js';
import { refreshSessionRepositoryToken } from './refresh-session.repository.js';
import { PrismaRefreshSessionRepository } from './prisma-refresh-session.repository.js';

const identityRepositoryProvider = {
  provide: authIdentityRepositoryToken,
  useClass: PrismaAuthIdentityRepository,
};
const refreshSessionRepositoryProvider = {
  provide: refreshSessionRepositoryToken,
  useClass: PrismaRefreshSessionRepository,
};

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-me',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenGuard,
    PermissionsGuard,
    LoginRateLimiter,
    identityRepositoryProvider,
    refreshSessionRepositoryProvider,
  ],
  exports: [AuthService, AccessTokenGuard, PermissionsGuard],
})
export class AuthModule {}
