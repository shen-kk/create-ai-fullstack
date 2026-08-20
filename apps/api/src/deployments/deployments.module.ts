import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DeploymentCheckService } from './deployment-check.service.js';
import { DeploymentsController } from './deployments.controller.js';
import { DeploymentsService } from './deployments.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentCheckService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
