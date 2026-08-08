import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
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

class DeploymentRunStatusDto {
  @IsIn(['queued', 'building', 'deploying', 'succeeded', 'failed', 'cancelled', 'rolled_back'])
  status!:
    'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled' | 'rolled_back';
  @IsOptional()
  @IsString()
  currentStep?: string | null;
  @IsOptional()
  @IsString()
  errorCode?: string | null;
  @IsOptional()
  @IsArray()
  steps?: unknown[];
}

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

  @Get(':id/runs/:runId')
  getRun(@Param('id') id: string, @Param('runId') runId: string): Promise<DeploymentRunSummary> {
    return this.deployments.getRun(id, runId);
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

  @Post('internal/runs/:runId/status')
  async updateRunStatus(
    @Param('runId') runId: string,
    @Headers('x-deployment-callback-token') token: string | undefined,
    @Body() input: DeploymentRunStatusDto,
  ): Promise<DeploymentRunSummary> {
    const expected = process.env.DEPLOYMENT_CALLBACK_TOKEN;
    if (!expected || !token || token !== expected)
      throw new UnauthorizedException('DEPLOYMENT_CALLBACK_UNAUTHORIZED');
    return this.deployments.updateRunStatus(runId, input);
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
