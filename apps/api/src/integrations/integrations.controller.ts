import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthUser,
  IntegrationConfigSummary,
  IntegrationKind,
  ServiceResourceSummary,
  ServiceFeatureBindingSummary,
  ServiceFeatureCode,
  DeleteServiceResourceResponse,
  CustomerAuthSettings,
  MessageTemplateSummary,
  UpsertServiceResourceRequest,
} from '@template/contracts';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { UpdateIntegrationDto } from './dto/update-integration.dto.js';
import { UpdateServiceFeatureBindingDto } from './dto/update-service-feature-binding.dto.js';
import { UpdateCustomerAuthSettingsDto } from './dto/update-customer-auth-settings.dto.js';
import { IntegrationsService } from './integrations.service.js';
import { UpsertMessageTemplateDto } from './dto/upsert-message-template.dto.js';
@Controller('integrations')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('integrations.manage')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}
  @Get() list(): Promise<IntegrationConfigSummary[]> {
    return this.service.list();
  }
  @Get('resources/list') listResources(
    @Query('kind') kind?: IntegrationKind,
  ): Promise<ServiceResourceSummary[]> {
    return this.service.listResources(kind);
  }
  @Post('resources') createResource(
    @Body() input: UpsertServiceResourceRequest,
  ): Promise<ServiceResourceSummary> {
    return this.service.createResource(input);
  }
  @Put('resources/:id') updateResource(
    @Param('id') id: string,
    @Body() input: UpsertServiceResourceRequest,
  ): Promise<ServiceResourceSummary> {
    return this.service.updateResource(id, input);
  }
  @Get('resources/:id/secrets')
  @RequirePermissions('secrets.read')
  getResourceSecrets(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<Record<string, string>> {
    return this.service.getResourceSecrets(id, {
      actorId: request.user.id,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });
  }
  @Delete('resources/:id') deleteResource(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<DeleteServiceResourceResponse> {
    return this.service.deleteResource(id, {
      actorId: request.user.id,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });
  }
  @Get('bindings/list') listBindings(): Promise<ServiceFeatureBindingSummary[]> {
    return this.service.listFeatureBindings();
  }
  @Get('message-templates') listMessageTemplates(): Promise<MessageTemplateSummary[]> {
    return this.service.listMessageTemplates();
  }
  @Post('message-templates') createMessageTemplate(
    @Body() input: UpsertMessageTemplateDto,
  ): Promise<MessageTemplateSummary> {
    return this.service.createMessageTemplate(input);
  }
  @Put('message-templates/:id') updateMessageTemplate(
    @Param('id') id: string,
    @Body() input: UpsertMessageTemplateDto,
  ): Promise<MessageTemplateSummary> {
    return this.service.updateMessageTemplate(id, input);
  }
  @Delete('message-templates/:id') deleteMessageTemplate(
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    return this.service.deleteMessageTemplate(id);
  }
  @Get('customer-auth/settings') customerAuthSettings(): Promise<CustomerAuthSettings> {
    return this.service.getCustomerAuthSettings();
  }
  @Put('customer-auth/settings') updateCustomerAuthSettings(
    @Body() input: UpdateCustomerAuthSettingsDto,
  ): Promise<CustomerAuthSettings> {
    return this.service.updateCustomerAuthSettings(input);
  }
  @Put('bindings/:code') updateBinding(
    @Param('code') code: ServiceFeatureCode,
    @Body() input: UpdateServiceFeatureBindingDto,
  ): Promise<ServiceFeatureBindingSummary> {
    return this.service.updateFeatureBinding(code, input.resourceId, input.templateId);
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
