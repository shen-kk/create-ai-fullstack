import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { auditRepositoryToken } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { MemoryAuditRepository } from './memory-audit.repository.js';
import { PrismaAuditRepository } from './prisma-audit.repository.js';

const repositoryProvider = {
  provide: auditRepositoryToken,
  useClass: process.env.DATA_SOURCE === 'prisma' ? PrismaAuditRepository : MemoryAuditRepository,
};
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService, repositoryProvider],
  exports: [AuditService],
})
export class AuditModule {}
