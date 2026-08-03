import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module.js';
import { LoginRateLimiter } from '../auth/login-rate-limiter.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CustomerAccessGuard } from './customer-access.guard.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerRepository } from './customer.repository.js';
import { CustomerSessionRepository } from './customer-session.repository.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { VerificationService } from './verification.service.js';
import { AdminVerificationController } from './admin-verification.controller.js';
import { AdminVerificationLogsController } from './admin-verification-logs.controller.js';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    IntegrationsModule,
    JwtModule.register({
      secret:
        process.env.CUSTOMER_JWT_ACCESS_SECRET ??
        process.env.JWT_ACCESS_SECRET ??
        'development-customer-access-secret',
    }),
  ],
  controllers: [
    CustomerAuthController,
    AdminCustomersController,
    AdminVerificationController,
    AdminVerificationLogsController,
  ],
  providers: [
    CustomerAuthService,
    CustomerAccessGuard,
    CustomerRepository,
    CustomerSessionRepository,
    LoginRateLimiter,
    VerificationService,
  ],
})
export class CustomerAuthModule {}
