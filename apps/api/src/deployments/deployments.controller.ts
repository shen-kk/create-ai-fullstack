import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type {
  AuthUser,
  DeploymentConnectionTestResult,
  DeploymentRunSummary,
  DeploymentTargetSummary,
} from '@template/contracts';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CreateDeploymentRunDto } from './dto/create-deployment-run.dto.js';
import { UpsertDeploymentTargetDto } from './dto/upsert-deployment-target.dto.js';
import { DeploymentsService } from './deployments.service.js';

type AuthenticatedRequest = Request & { user: AuthUser; requestId?: string };

@ApiTags('deployments')
@ApiBearerAuth()
@Controller('deployments')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('deployments.read')
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get()
  listTargets(): Promise<DeploymentTargetSummary[]> {
    return this.deployments.listTargets();
  }

  @Get(':id')
  getTarget(@Param('id') id: string): Promise<DeploymentTargetSummary> {
    return this.deployments.getTarget(id);
  }

  @Post()
  @RequirePermissions('deployments.manage')
  createTarget(
    @Body() input: UpsertDeploymentTargetDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentTargetSummary> {
    return this.deployments.createTarget(input, this.context(request));
  }

  @Patch(':id')
  @RequirePermissions('deployments.manage')
  updateTarget(
    @Param('id') id: string,
    @Body() input: UpsertDeploymentTargetDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentTargetSummary> {
    return this.deployments.updateTarget(id, input, this.context(request));
  }

  @Post(':id/test-connection')
  @RequirePermissions('deployments.manage')
  testConnection(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentConnectionTestResult> {
    return this.deployments.testConnection(id, this.context(request));
  }

  @Get(':id/runs')
  listRuns(@Param('id') id: string): Promise<DeploymentRunSummary[]> {
    return this.deployments.listRuns(id);
  }

  @Post(':id/runs')
  @RequirePermissions('deployments.execute')
  startRun(
    @Param('id') id: string,
    @Body() input: CreateDeploymentRunDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentRunSummary> {
    return this.deployments.startRun(id, input, this.context(request));
  }

  private context(request: AuthenticatedRequest): {
    actorId: string;
    requestId?: string;
    ipAddress?: string;
  } {
    return {
      actorId: request.user.id,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    };
  }
}
