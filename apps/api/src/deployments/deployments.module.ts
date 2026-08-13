import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DeploymentCheckService } from './deployment-check.service.js';
import { DeploymentsController } from './deployments.controller.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentWorkerService } from './deployment-worker.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentCheckService, DeploymentWorkerService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
