import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeployEnvironmentKind as PrismaEnvironmentKind,
  DeployEnvironmentStatus as PrismaEnvironmentStatus,
  DeployRunStatus as PrismaRunStatus,
  type DeployEnvironment,
  type DeployRun,
  type DeployStep,
  type Prisma,
} from '@prisma/client';
import type {
  CreateDeploymentRunRequest,
  DeploymentCheckResult,
  DeploymentEnvironmentSummary,
  DeploymentLogEntry,
  DeploymentReleaseSummary,
  DeploymentRunSummary,
  UpsertDeploymentEnvironmentRequest,
} from '@template/contracts';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeploymentCheckService } from './deployment-check.service.js';
import {
  decryptDeploymentSecrets,
  encryptDeploymentSecrets,
  type DeploymentSecrets,
} from './deployment-secrets.js';

interface AuditContext {
  actorId: string;
  requestId?: string;
  ipAddress?: string;
}
const kindToPrisma = {
  development: PrismaEnvironmentKind.DEVELOPMENT,
  test: PrismaEnvironmentKind.TEST,
  staging: PrismaEnvironmentKind.STAGING,
  production: PrismaEnvironmentKind.PRODUCTION,
  custom: PrismaEnvironmentKind.CUSTOM,
} as const;
const kindFromPrisma = Object.fromEntries(
  Object.entries(kindToPrisma).map(([key, value]) => [value, key]),
) as Record<PrismaEnvironmentKind, DeploymentEnvironmentSummary['kind']>;
const environmentStatus = {
  DRAFT: 'draft',
  VERIFIED: 'verified',
  UNREACHABLE: 'unreachable',
} as const;
const runStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ROLLING_BACK: 'rolling_back',
  ROLLED_BACK: 'rolled_back',
} as const;
const stepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;
const secretKeys = ['gitToken', 'gitSshPrivateKey', 'sshPassword', 'sshPrivateKey', 'databaseUrl', 'jwtAccessSecret', 'jwtRefreshSecret', 'configEncryptionKey', 'customerJwtAccessSecret', 'customerJwtRefreshSecret'] as const;
const activeStatuses = [
  PrismaRunStatus.QUEUED,
  PrismaRunStatus.RUNNING,
  PrismaRunStatus.ROLLING_BACK,
];

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checker: DeploymentCheckService,
    private readonly audit: AuditService,
  ) {}

  async listEnvironments(): Promise<DeploymentEnvironmentSummary[]> {
    const rows = await this.prisma.deployEnvironment.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.environmentSummary(row));
  }
  async getEnvironment(id: string): Promise<DeploymentEnvironmentSummary> {
    const row = await this.requireEnvironment(id);
    return this.environmentSummary(row);
  }
  async getEnvironmentSecrets(id: string): Promise<DeploymentSecrets> {
    const row = await this.requireEnvironment(id);
    const secrets = decryptDeploymentSecrets(row.encryptedSecrets);
    return Object.fromEntries(secretKeys.map((key) => [key, secrets[key]]).filter(([, value]) => value)) as DeploymentSecrets;
  }
  async createEnvironment(
    input: UpsertDeploymentEnvironmentRequest,
    context: AuditContext,
  ): Promise<DeploymentEnvironmentSummary> {
    this.validateEnvironment(input);
    const secrets = this.cleanSecrets(input.secrets);
    this.validateSecrets(input, secrets);
    try {
      const row = await this.prisma.deployEnvironment.create({
        data: this.environmentData(input, encryptDeploymentSecrets(secrets)),
      });
      await this.audit.record({
        ...context,
        action: 'deployment.environment.create',
        resource: 'deploy_environment',
        resourceId: row.id,
        result: 'success',
        metadata: { kind: input.kind, applications: input.applications },
      });
      return this.environmentSummary(row);
    } catch (error) {
      if (this.isUniqueError(error))
        throw new ConflictException('DEPLOYMENT_ENVIRONMENT_NAME_EXISTS');
      throw error;
    }
  }
  async updateEnvironment(
    id: string,
    input: UpsertDeploymentEnvironmentRequest,
    context: AuditContext,
  ): Promise<DeploymentEnvironmentSummary> {
    this.validateEnvironment(input);
    const current = await this.requireEnvironment(id);
    const secrets = {
      ...decryptDeploymentSecrets(current.encryptedSecrets),
      ...this.cleanSecrets(input.secrets),
    };
    this.validateSecrets(input, secrets);
    try {
      const row = await this.prisma.deployEnvironment.update({
        where: { id },
        data: {
          ...this.environmentData(input, encryptDeploymentSecrets(secrets)),
          status: PrismaEnvironmentStatus.DRAFT,
          gitVerifiedAt: null,
          serverVerifiedAt: null,
          lastVerifiedAt: null,
        },
      });
      await this.audit.record({
        ...context,
        action: 'deployment.environment.update',
        resource: 'deploy_environment',
        resourceId: id,
        result: 'success',
        metadata: { kind: input.kind, applications: input.applications },
      });
      return this.environmentSummary(row);
    } catch (error) {
      if (this.isUniqueError(error))
        throw new ConflictException('DEPLOYMENT_ENVIRONMENT_NAME_EXISTS');
      throw error;
    }
  }
  async checkGit(id: string): Promise<DeploymentCheckResult> {
    const row = await this.requireEnvironment(id);
    const result = await this.checker.checkGit(
      row.repositoryUrl,
      row.gitRef,
      decryptDeploymentSecrets(row.encryptedSecrets),
    );
    const latest = await this.requireEnvironment(id);
    const now = result.success ? new Date() : null;
    await this.prisma.deployEnvironment.update({
      where: { id },
      data: {
        gitVerifiedAt: now,
        status:
          result.success && latest.serverVerifiedAt
            ? PrismaEnvironmentStatus.VERIFIED
            : result.success
              ? PrismaEnvironmentStatus.DRAFT
              : PrismaEnvironmentStatus.UNREACHABLE,
        lastVerifiedAt: result.success && latest.serverVerifiedAt ? new Date() : null,
      },
    });
    return result;
  }
  async checkServer(id: string): Promise<DeploymentCheckResult> {
    const row = await this.requireEnvironment(id);
    const result = await this.checker.checkServer(
      {
        host: row.host,
        port: row.sshPort,
        user: row.sshUser,
        authMode: row.sshAuthMode,
        deployPath: row.deployPath,
      },
      decryptDeploymentSecrets(row.encryptedSecrets),
    );
    const latest = await this.requireEnvironment(id);
    const now = result.success ? new Date() : null;
    await this.prisma.deployEnvironment.update({
      where: { id },
      data: {
        serverVerifiedAt: now,
        status:
          result.success && latest.gitVerifiedAt
            ? PrismaEnvironmentStatus.VERIFIED
            : result.success
              ? PrismaEnvironmentStatus.DRAFT
              : PrismaEnvironmentStatus.UNREACHABLE,
        lastVerifiedAt: result.success && latest.gitVerifiedAt ? new Date() : null,
      },
    });
    return result;
  }
  async listRuns(environmentId: string): Promise<DeploymentRunSummary[]> {
    await this.requireEnvironment(environmentId);
    const rows = await this.prisma.deployRun.findMany({
      where: { environmentId },
      include: { steps: { orderBy: { position: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
    return rows.map((row) => this.runSummary(row));
  }
  async getRun(runId: string): Promise<DeploymentRunSummary> {
    const row = await this.prisma.deployRun.findUnique({
      where: { id: runId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!row) throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
    return this.runSummary(row);
  }
  async listLogs(runId: string, after = 0): Promise<DeploymentLogEntry[]> {
    await this.getRun(runId);
    const rows = await this.prisma.deployLog.findMany({
      where: { runId, sequence: { gt: after } },
      orderBy: { sequence: 'asc' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      level: row.level as DeploymentLogEntry['level'],
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async createRun(
    environmentId: string,
    input: CreateDeploymentRunRequest,
    context: AuditContext,
  ): Promise<DeploymentRunSummary> {
    const environment = await this.requireEnvironment(environmentId);
    if (environment.status !== PrismaEnvironmentStatus.VERIFIED)
      throw new BadRequestException('DEPLOYMENT_ENVIRONMENT_NOT_VERIFIED');
    const applications = [...new Set(input.applications)];
    if (
      !applications.length ||
      applications.some((item) => !environment.applications.includes(item))
    )
      throw new BadRequestException('DEPLOYMENT_APPLICATION_NOT_ALLOWED');
    const active = await this.prisma.deployRun.findFirst({
      where: { environmentId, status: { in: activeStatuses } },
    });
    if (active) throw new ConflictException('DEPLOYMENT_ALREADY_RUNNING');
    const labels = [
      ['prepare', '准备任务'],
      ['checkout', '获取代码'],
      ['build', '构建应用'],
      ...(applications.includes('api') ? ([['migrate', '数据库迁移']] as const) : []),
      ['upload', '上传服务器'],
      ['start', '启动新版本'],
      ['health', '健康检查'],
      ['switch', '切换版本'],
    ] as const;
    const row = await this.prisma.deployRun.create({
      data: {
        environmentId,
        actorId: context.actorId,
        gitRef: input.gitRef?.trim() || environment.gitRef,
        applications,
        steps: { create: labels.map(([key, label], position) => ({ key, label, position })) },
        logs: { create: { sequence: 1, level: 'info', message: '部署任务已进入队列' } },
      },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    await this.audit.record({
      ...context,
      action: 'deployment.run.create',
      resource: 'deploy_run',
      resourceId: row.id,
      result: 'success',
      metadata: { environmentId, applications, gitRef: row.gitRef },
    });
    return this.runSummary(row);
  }
  async listReleases(environmentId: string): Promise<DeploymentReleaseSummary[]> {
    const environment = await this.requireEnvironment(environmentId);
    const rows = await this.prisma.deployRelease.findMany({
      where: { environmentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      environmentId,
      version: row.version,
      commitSha: row.commitSha,
      applications: row.applications as DeploymentReleaseSummary['applications'],
      createdAt: row.createdAt.toISOString(),
      current: row.id === environment.currentReleaseId,
    }));
  }
  async createRollback(
    environmentId: string,
    releaseId: string,
    context: AuditContext,
  ): Promise<DeploymentRunSummary> {
    const environment = await this.requireEnvironment(environmentId);
    const release = await this.prisma.deployRelease.findFirst({
      where: { id: releaseId, environmentId },
    });
    if (!release) throw new NotFoundException('DEPLOYMENT_RELEASE_NOT_FOUND');
    if (release.id === environment.currentReleaseId)
      throw new ConflictException('DEPLOYMENT_RELEASE_ALREADY_CURRENT');
    const active = await this.prisma.deployRun.findFirst({
      where: { environmentId, status: { in: activeStatuses } },
    });
    if (active) throw new ConflictException('DEPLOYMENT_ALREADY_RUNNING');
    const labels = [
      ['prepare', '准备回滚'],
      ['start', '启动历史版本'],
      ['health', '健康检查'],
      ['switch', '切换版本'],
    ] as const;
    const row = await this.prisma.deployRun.create({
      data: {
        environmentId,
        actorId: context.actorId,
        gitRef: release.version,
        commitSha: release.commitSha,
        applications: release.applications,
        releaseId: release.id,
        status: PrismaRunStatus.QUEUED,
        steps: { create: labels.map(([key, label], position) => ({ key, label, position })) },
        logs: {
          create: {
            sequence: 1,
            level: 'info',
            message: `回滚任务已进入队列，目标版本 ${release.version}`,
          },
        },
      },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    await this.audit.record({
      ...context,
      action: 'deployment.rollback.create',
      resource: 'deploy_run',
      resourceId: row.id,
      result: 'success',
      metadata: { environmentId, releaseId },
    });
    return this.runSummary(row);
  }
  async cancelRun(runId: string, context: AuditContext): Promise<DeploymentRunSummary> {
    const current = await this.getRun(runId);
    if (!['queued', 'running'].includes(current.status))
      throw new ConflictException('DEPLOYMENT_RUN_NOT_CANCELLABLE');
    await this.prisma.deployRun.update({
      where: { id: runId },
      data: {
        status: PrismaRunStatus.CANCELLED,
        completedAt: new Date(),
        errorCode: 'DEPLOYMENT_CANCELLED',
        errorMessage: '部署已由管理员取消',
      },
    });
    await this.audit.record({
      ...context,
      action: 'deployment.run.cancel',
      resource: 'deploy_run',
      resourceId: runId,
      result: 'success',
    });
    return this.getRun(runId);
  }
  private async requireEnvironment(id: string): Promise<DeployEnvironment> {
    const row = await this.prisma.deployEnvironment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DEPLOYMENT_ENVIRONMENT_NOT_FOUND');
    return row;
  }
  private validateEnvironment(input: UpsertDeploymentEnvironmentRequest): void {
    if (
      !input.name.trim() ||
      !input.repositoryUrl.trim() ||
      !input.gitRef.trim() ||
      !input.host.trim() ||
      !input.sshUser.trim() ||
      !input.deployPath.startsWith('/')
    )
      throw new BadRequestException('DEPLOYMENT_CONFIGURATION_INVALID');
    if (!input.applications.length)
      throw new BadRequestException('DEPLOYMENT_APPLICATION_REQUIRED');
    try {
      new URL(input.repositoryUrl);
    } catch {
      if (!/^git@[^:]+:.+/.test(input.repositoryUrl))
        throw new BadRequestException('DEPLOYMENT_REPOSITORY_URL_INVALID');
    }
  }
  private validateSecrets(
    input: UpsertDeploymentEnvironmentRequest,
    secrets: DeploymentSecrets,
  ): void {
    if (input.gitAuthMode === 'token' && !secrets.gitToken)
      throw new BadRequestException('DEPLOYMENT_GIT_TOKEN_REQUIRED');
    if (input.gitAuthMode === 'ssh_key' && !secrets.gitSshPrivateKey)
      throw new BadRequestException('DEPLOYMENT_GIT_KEY_REQUIRED');
    if (input.sshAuthMode === 'password' && !secrets.sshPassword)
      throw new BadRequestException('DEPLOYMENT_SSH_PASSWORD_REQUIRED');
    if (input.sshAuthMode === 'private_key' && !secrets.sshPrivateKey)
      throw new BadRequestException('DEPLOYMENT_SSH_KEY_REQUIRED');
    if (input.applications.includes('api')) {
      for (const [key, code] of [['databaseUrl', 'DEPLOYMENT_DATABASE_URL_REQUIRED'], ['jwtAccessSecret', 'DEPLOYMENT_JWT_ACCESS_SECRET_REQUIRED'], ['jwtRefreshSecret', 'DEPLOYMENT_JWT_REFRESH_SECRET_REQUIRED'], ['configEncryptionKey', 'DEPLOYMENT_CONFIG_KEY_REQUIRED']] as const)
        if (!secrets[key]) throw new BadRequestException(code);
    }
    if (input.applications.includes('web')) {
      if (!secrets.customerJwtAccessSecret) throw new BadRequestException('DEPLOYMENT_CUSTOMER_JWT_ACCESS_SECRET_REQUIRED');
      if (!secrets.customerJwtRefreshSecret) throw new BadRequestException('DEPLOYMENT_CUSTOMER_JWT_REFRESH_SECRET_REQUIRED');
    }
  }
  private cleanSecrets(input: DeploymentSecrets): DeploymentSecrets {
    const result: DeploymentSecrets = {};
    for (const key of secretKeys) {
      const value = input[key]?.trim();
      if (value) result[key] = value;
    }
    return result;
  }
  private environmentData(
    input: UpsertDeploymentEnvironmentRequest,
    encryptedSecrets: string,
  ): Prisma.DeployEnvironmentUncheckedCreateInput {
    return {
      name: input.name.trim(),
      kind: kindToPrisma[input.kind],
      applications: [...new Set(input.applications)],
      gitProvider: input.gitProvider,
      repositoryUrl: input.repositoryUrl.trim(),
      gitRef: input.gitRef.trim(),
      gitAuthMode: input.gitAuthMode,
      host: input.host.trim(),
      sshPort: input.sshPort,
      sshUser: input.sshUser.trim(),
      sshAuthMode: input.sshAuthMode,
      deployPath: input.deployPath.trim(),
      adminUrl: input.adminUrl?.trim() || null,
      apiUrl: input.apiUrl?.trim() || null,
      webUrl: input.webUrl?.trim() || null,
      healthCheckUrl: input.healthCheckUrl?.trim() || null,
      retainReleases: input.retainReleases,
      encryptedSecrets,
    };
  }
  private environmentSummary(row: DeployEnvironment): DeploymentEnvironmentSummary {
    return {
      id: row.id,
      name: row.name,
      kind: kindFromPrisma[row.kind],
      applications: row.applications as DeploymentEnvironmentSummary['applications'],
      gitProvider: row.gitProvider as DeploymentEnvironmentSummary['gitProvider'],
      repositoryUrl: row.repositoryUrl,
      gitRef: row.gitRef,
      gitAuthMode: row.gitAuthMode as DeploymentEnvironmentSummary['gitAuthMode'],
      host: row.host,
      sshPort: row.sshPort,
      sshUser: row.sshUser,
      sshAuthMode: row.sshAuthMode as DeploymentEnvironmentSummary['sshAuthMode'],
      deployPath: row.deployPath,
      adminUrl: row.adminUrl,
      apiUrl: row.apiUrl,
      webUrl: row.webUrl,
      healthCheckUrl: row.healthCheckUrl,
      retainReleases: row.retainReleases,
      configuredSecrets: secretKeys.filter((key) =>
        Boolean(decryptDeploymentSecrets(row.encryptedSecrets)[key]),
      ),
      status: environmentStatus[row.status],
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
      currentRelease: row.currentReleaseId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private runSummary(row: DeployRun & { steps: DeployStep[] }): DeploymentRunSummary {
    return {
      id: row.id,
      environmentId: row.environmentId,
      actorId: row.actorId,
      gitRef: row.gitRef,
      commitSha: row.commitSha,
      applications: row.applications as DeploymentRunSummary['applications'],
      status: runStatus[row.status],
      progress: row.progress,
      currentStep: row.currentStep,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      releaseId: row.releaseId,
      steps: row.steps.map((step) => ({
        id: step.id,
        key: step.key,
        label: step.label,
        status: stepStatus[step.status],
        progress: step.progress,
        message: step.message,
        startedAt: step.startedAt?.toISOString() ?? null,
        completedAt: step.completedAt?.toISOString() ?? null,
      })),
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
