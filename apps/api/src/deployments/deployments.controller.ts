import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthUser,
  DeploymentCheckResult,
  DeploymentEnvironmentSummary,
  DeploymentLogEntry,
  DeploymentProjectSummary,
  DeploymentReleaseSummary,
  DeploymentRunSummary,
} from '@template/contracts';
import type { Request } from 'express';
import {
  distinctUntilChanged,
  from,
  interval,
  map,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CreateDeploymentRunDto } from './dto/create-deployment-run.dto.js';
import { UpsertDeploymentEnvironmentDto } from './dto/upsert-deployment-environment.dto.js';
import { UpsertDeploymentProjectDto } from './dto/upsert-deployment-project.dto.js';
import { DeploymentsService } from './deployments.service.js';

type AuthenticatedRequest = Request & { user: AuthUser; requestId?: string };

@ApiTags('deployments')
@ApiBearerAuth()
@Controller('deployments')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('deployments.read')
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get('projects') listProjects(): Promise<DeploymentProjectSummary[]> {
    return this.deployments.listProjects();
  }
  @Get('projects/:id') getProject(@Param('id') id: string): Promise<DeploymentProjectSummary> {
    return this.deployments.getProject(id);
  }
  @Post('projects') @RequirePermissions('deployments.manage') createProject(
    @Body() input: UpsertDeploymentProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentProjectSummary> {
    return this.deployments.createProject(input, this.context(request));
  }
  @Patch('projects/:id') @RequirePermissions('deployments.manage') updateProject(
    @Param('id') id: string,
    @Body() input: UpsertDeploymentProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentProjectSummary> {
    return this.deployments.updateProject(id, input, this.context(request));
  }

  @Get('environments') listEnvironments(): Promise<DeploymentEnvironmentSummary[]> {
    return this.deployments.listEnvironments();
  }
  @Get('environments/:id') getEnvironment(
    @Param('id') id: string,
  ): Promise<DeploymentEnvironmentSummary> {
    return this.deployments.getEnvironment(id);
  }
  @Get('environments/:id/secrets') @RequirePermissions('secrets.read') getEnvironmentSecrets(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.deployments.getEnvironmentSecrets(id, this.context(request));
  }
  @Post('environments') @RequirePermissions('deployments.manage') createEnvironment(
    @Body() input: UpsertDeploymentEnvironmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentEnvironmentSummary> {
    return this.deployments.createEnvironment(input, this.context(request));
  }
  @Patch('environments/:id') @RequirePermissions('deployments.manage') updateEnvironment(
    @Param('id') id: string,
    @Body() input: UpsertDeploymentEnvironmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentEnvironmentSummary> {
    return this.deployments.updateEnvironment(id, input, this.context(request));
  }
  @Post('environments/:id/check-git') @RequirePermissions('deployments.manage') checkGit(
    @Param('id') id: string,
  ): Promise<DeploymentCheckResult> {
    return this.deployments.checkGit(id);
  }
  @Post('environments/:id/check-server') @RequirePermissions('deployments.manage') checkServer(
    @Param('id') id: string,
  ): Promise<DeploymentCheckResult> {
    return this.deployments.checkServer(id);
  }
  @Get('environments/:id/runs') listRuns(@Param('id') id: string): Promise<DeploymentRunSummary[]> {
    return this.deployments.listRuns(id);
  }
  @Post('environments/:id/runs') @RequirePermissions('deployments.execute') createRun(
    @Param('id') id: string,
    @Body() input: CreateDeploymentRunDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentRunSummary> {
    return this.deployments.createRun(id, input, this.context(request));
  }
  @Get('environments/:id/releases') listReleases(
    @Param('id') id: string,
  ): Promise<DeploymentReleaseSummary[]> {
    return this.deployments.listReleases(id);
  }
  @Post('environments/:id/releases/:releaseId/rollback')
  @RequirePermissions('deployments.rollback')
  rollback(
    @Param('id') id: string,
    @Param('releaseId') releaseId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentRunSummary> {
    return this.deployments.createRollback(id, releaseId, this.context(request));
  }
  @Get('runs/:runId') getRun(@Param('runId') runId: string): Promise<DeploymentRunSummary> {
    return this.deployments.getRun(runId);
  }
  @Get('runs/:runId/logs') listLogs(
    @Param('runId') runId: string,
    @Query('after') after?: string,
  ): Promise<DeploymentLogEntry[]> {
    return this.deployments.listLogs(runId, Number(after) || 0);
  }
  @Post('runs/:runId/cancel') @RequirePermissions('deployments.execute') cancelRun(
    @Param('runId') runId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeploymentRunSummary> {
    return this.deployments.cancelRun(runId, this.context(request));
  }
  @Sse('runs/:runId/events') streamRun(
    @Param('runId') runId: string,
  ): Observable<{ data: { run: DeploymentRunSummary; logs: DeploymentLogEntry[] } }> {
    let sequence = 0;
    return interval(1000).pipe(
      startWith(0),
      switchMap(() =>
        from(
          Promise.all([this.deployments.getRun(runId), this.deployments.listLogs(runId, sequence)]),
        ),
      ),
      map(([run, logs]) => {
        if (logs.length) sequence = logs.at(-1)?.sequence ?? sequence;
        return { data: { run, logs } };
      }),
      distinctUntilChanged(
        (left, right) => JSON.stringify(left.data) === JSON.stringify(right.data),
      ),
    );
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
