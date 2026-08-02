import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvatarController } from './avatar.controller.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { AvatarStorageService } from './avatar-storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController, AvatarController],
  providers: [IntegrationsService, AvatarStorageService],
  exports: [IntegrationsService, AvatarStorageService],
})
export class IntegrationsModule {}
