import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AuditModule } from './audit/audit.module.js';
import { StructuredLogger } from './logging/structured-logger.js';
import { HttpLoggingMiddleware } from './logging/http-logging.middleware.js';
import { IntegrationsModule } from './integrations/integrations.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, HealthModule, UsersModule, IntegrationsModule],
  providers: [StructuredLogger, HttpLoggingMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, HttpLoggingMiddleware).forRoutes('*');
  }
}
