import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DeploymentWorkerService } from './deployment-worker.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [DeploymentWorkerService],
})
export class DeploymentWorkerModule {}
