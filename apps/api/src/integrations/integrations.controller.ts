import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthUser, IntegrationConfigSummary, IntegrationKind } from '@template/contracts';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { UpdateIntegrationDto } from './dto/update-integration.dto.js';
import { IntegrationsService } from './integrations.service.js';
@Controller('integrations')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('integrations.manage')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}
  @Get() list(): Promise<IntegrationConfigSummary[]> {
    return this.service.list();
  }
  @Put(':kind') update(
    @Param('kind') kind: IntegrationKind,
    @Body() input: UpdateIntegrationDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<IntegrationConfigSummary> {
    return this.service.update(kind, input, {
      actorId: request.user.id,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });
  }
}
