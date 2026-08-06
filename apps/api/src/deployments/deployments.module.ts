import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DeploymentConnectionService } from './deployment-connection.service.js';
import { DeploymentsController } from './deployments.controller.js';
import { DeploymentsService } from './deployments.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentConnectionService],
})
export class DeploymentsModule {}
