import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeploymentEnvironment,
  DeploymentRunStatus as PrismaRunStatus,
  DeploymentTargetStatus as PrismaTargetStatus,
  type DeploymentRun,
  type DeploymentTarget,
  type Prisma,
} from '@prisma/client';
import type {
  CreateDeploymentRunRequest,
  DeployableApplication,
  DeploymentConnectionTestResult,
  DeploymentEnvironmentKind,
  DeploymentRunStatus,
  DeploymentRunStep,
  DeploymentRunSummary,
  DeploymentTargetStatus,
  DeploymentTargetSummary,
  UpsertDeploymentTargetRequest,
} from '@template/contracts';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { project } from '../generated/project.js';
import { DeploymentConnectionService } from './deployment-connection.service.js';
import {
  decryptDeploymentSecrets,
  encryptDeploymentSecrets,
  type DeploymentSecrets,
} from './deployment-secrets.js';

interface DeploymentAuditContext {
  actorId: string;
  requestId?: string;
  ipAddress?: string;
}

interface MemoryTarget extends DeploymentTargetSummary {
  encryptedSecrets: string;
}

const memoryTargets = new Map<string, MemoryTarget>();
const memoryRuns = new Map<string, DeploymentRunSummary>();
const environmentToPrisma: Record<DeploymentEnvironmentKind, DeploymentEnvironment> = {
  development: DeploymentEnvironment.DEVELOPMENT,
  test: DeploymentEnvironment.TEST,
  staging: DeploymentEnvironment.STAGING,
  production: DeploymentEnvironment.PRODUCTION,
  custom: DeploymentEnvironment.CUSTOM,
};
const environmentFromPrisma = Object.fromEntries(
  Object.entries(environmentToPrisma).map(([key, value]) => [value, key]),
) as Record<DeploymentEnvironment, DeploymentEnvironmentKind>;
const statusFromPrisma: Record<PrismaTargetStatus, DeploymentTargetStatus> = {
  DRAFT: 'draft',
  VERIFIED: 'verified',
  UNREACHABLE: 'unreachable',
};
const runStatusFromPrisma: Record<PrismaRunStatus, DeploymentRunStatus> = {
  QUEUED: 'queued',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ROLLED_BACK: 'rolled_back',
};
const secretKeys = ['sshPrivateKey', 'sshPassword', 'cnbToken', 'registryToken'] as const;
const isSecretKey = (value: string): value is (typeof secretKeys)[number] =>
  secretKeys.some((key) => key === value);
const activeRunStatuses = [
  PrismaRunStatus.QUEUED,
  PrismaRunStatus.BUILDING,
  PrismaRunStatus.DEPLOYING,
];

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connection: DeploymentConnectionService,
    private readonly audit: AuditService,
  ) {}

  async listTargets(): Promise<DeploymentTargetSummary[]> {
    if (!this.isPrisma())
      return [...memoryTargets.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((target) => this.toMemoryTargetSummary(target));
    const rows = await this.prisma.deploymentTarget.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map((row) => this.toTargetSummary(row));
  }

  async getTarget(id: string): Promise<DeploymentTargetSummary> {
    if (!this.isPrisma()) {
      const row = memoryTargets.get(id);
      if (!row) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
      return this.toMemoryTargetSummary(row);
    }
    const row = await this.prisma.deploymentTarget.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
    return this.toTargetSummary(row);
  }

  async createTarget(
    input: UpsertDeploymentTargetRequest,
    context: DeploymentAuditContext,
  ): Promise<DeploymentTargetSummary> {
    this.validateTarget(input);
    const secrets = this.cleanSecrets(input.secrets);
    if (!secrets.sshPrivateKey && !secrets.sshPassword)
      throw new BadRequestException('DEPLOYMENT_SSH_CREDENTIAL_REQUIRED');
    let target: DeploymentTargetSummary;
    if (this.isPrisma()) {
      try {
        const row = await this.prisma.deploymentTarget.create({
          data: this.targetData(input, encryptDeploymentSecrets(secrets)),
        });
        target = this.toTargetSummary(row);
      } catch (error) {
        if (this.isUniqueError(error)) throw new ConflictException('DEPLOYMENT_NAME_EXISTS');
        throw error;
      }
    } else {
      if ([...memoryTargets.values()].some((item) => item.name === input.name.trim()))
        throw new ConflictException('DEPLOYMENT_NAME_EXISTS');
      const now = new Date().toISOString();
      const id = randomUUID();
      const stored: MemoryTarget = {
        id,
        ...this.targetFields(input),
        configuredSecrets: Object.keys(secrets),
        status: 'draft',
        lastVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
        encryptedSecrets: encryptDeploymentSecrets(secrets),
      };
      memoryTargets.set(id, stored);
      target = this.toMemoryTargetSummary(stored);
    }
    await this.audit.record({
      ...context,
      action: 'deployment.target.create',
      resource: 'deployment_target',
      resourceId: target.id,
      result: 'success',
      metadata: { environment: target.environment, applications: target.applications },
    });
    return target;
  }

  async updateTarget(
    id: string,
    input: UpsertDeploymentTargetRequest,
    context: DeploymentAuditContext,
  ): Promise<DeploymentTargetSummary> {
    this.validateTarget(input);
    const existingSecrets = await this.getSecrets(id);
    const mergedSecrets = { ...existingSecrets, ...this.cleanSecrets(input.secrets) };
    let target: DeploymentTargetSummary;
    if (this.isPrisma()) {
      try {
        const row = await this.prisma.deploymentTarget.update({
          where: { id },
          data: {
            ...this.targetData(input, encryptDeploymentSecrets(mergedSecrets)),
            status: PrismaTargetStatus.DRAFT,
            lastVerifiedAt: null,
          },
        });
        target = this.toTargetSummary(row);
      } catch (error) {
        if (this.isNotFoundError(error)) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
        if (this.isUniqueError(error)) throw new ConflictException('DEPLOYMENT_NAME_EXISTS');
        throw error;
      }
    } else {
      const current = memoryTargets.get(id);
      if (!current) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
      const stored: MemoryTarget = {
        ...current,
        ...this.targetFields(input),
        configuredSecrets: Object.keys(mergedSecrets),
        encryptedSecrets: encryptDeploymentSecrets(mergedSecrets),
        status: 'draft',
        lastVerifiedAt: null,
        updatedAt: new Date().toISOString(),
      };
      memoryTargets.set(id, stored);
      target = this.toMemoryTargetSummary(stored);
    }
    await this.audit.record({
      ...context,
      action: 'deployment.target.update',
      resource: 'deployment_target',
      resourceId: id,
      result: 'success',
      metadata: { environment: target.environment, applications: target.applications },
    });
    return target;
  }

  async testConnection(
    id: string,
    context: DeploymentAuditContext,
  ): Promise<DeploymentConnectionTestResult> {
    const target = await this.getTarget(id);
    const result = await this.connection.test(target, await this.getSecrets(id));
    if (this.isPrisma())
      await this.prisma.deploymentTarget.update({
        where: { id },
        data: {
          status: result.success ? PrismaTargetStatus.VERIFIED : PrismaTargetStatus.UNREACHABLE,
          lastVerifiedAt: new Date(result.checkedAt),
        },
      });
    else {
      const stored = memoryTargets.get(id);
      if (stored)
        memoryTargets.set(id, {
          ...stored,
          status: result.success ? 'verified' : 'unreachable',
          lastVerifiedAt: result.checkedAt,
          updatedAt: result.checkedAt,
        });
    }
    await this.audit.record({
      ...context,
      action: 'deployment.target.verify',
      resource: 'deployment_target',
      resourceId: id,
      result: result.success ? 'success' : 'failure',
      metadata: { checks: result.checks.map(({ key, status }) => ({ key, status })) },
    });
    return result;
  }

  async listRuns(targetId: string): Promise<DeploymentRunSummary[]> {
    await this.getTarget(targetId);
    if (!this.isPrisma())
      return [...memoryRuns.values()]
        .filter((run) => run.targetId === targetId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rows = await this.prisma.deploymentRun.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toRunSummary(row));
  }

  async getRun(targetId: string, runId: string): Promise<DeploymentRunSummary> {
    await this.getTarget(targetId);
    if (!this.isPrisma()) {
      const run = memoryRuns.get(runId);
      if (!run || run.targetId !== targetId)
        throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
      return run;
    }
    const row = await this.prisma.deploymentRun.findFirst({
      where: { id: runId, targetId },
    });
    if (!row) throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
    return this.toRunSummary(row);
  }

  async updateRunStatus(
    runId: string,
    input: {
      status: DeploymentRunStatus;
      currentStep?: string | null;
      errorCode?: string | null;
      steps?: unknown[];
    },
  ): Promise<DeploymentRunSummary> {
    const allowedStatuses: DeploymentRunStatus[] = [
      'queued',
      'building',
      'deploying',
      'succeeded',
      'failed',
      'cancelled',
      'rolled_back',
    ];
    if (!allowedStatuses.includes(input.status))
      throw new BadRequestException('DEPLOYMENT_RUN_STATUS_INVALID');
    const terminal = ['succeeded', 'failed', 'cancelled', 'rolled_back'].includes(input.status);
    const completedAt = terminal ? new Date() : null;
    if (!this.isPrisma()) {
      const run = memoryRuns.get(runId);
      if (!run) throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
      const updated = {
        ...run,
        status: input.status,
        ...(input.currentStep !== undefined ? { currentStep: input.currentStep } : {}),
        ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
        ...(input.steps ? { steps: input.steps as DeploymentRunStep[] } : {}),
        ...(completedAt ? { completedAt: completedAt.toISOString() } : {}),
      };
      memoryRuns.set(runId, updated);
      return updated;
    }
    const row = await this.prisma.deploymentRun.findUnique({ where: { id: runId } });
    if (!row) throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
    const updated = await this.prisma.deploymentRun.update({
      where: { id: runId },
      data: {
        status: input.status.toUpperCase() as PrismaRunStatus,
        ...(input.currentStep !== undefined ? { currentStep: input.currentStep } : {}),
        ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
        ...(input.steps ? { steps: input.steps as Prisma.InputJsonValue } : {}),
        ...(completedAt ? { completedAt } : {}),
      },
    });
    return this.toRunSummary(updated);
  }

  async startRun(
    targetId: string,
    input: CreateDeploymentRunRequest,
    context: DeploymentAuditContext,
  ): Promise<DeploymentRunSummary> {
    const target = await this.getTarget(targetId);
    if (target.status !== 'verified') throw new ConflictException('DEPLOYMENT_TARGET_NOT_VERIFIED');
    const applications = [...new Set(input.applications)];
    if (applications.some((application) => !target.applications.includes(application)))
      throw new BadRequestException('DEPLOYMENT_APPLICATION_NOT_CONFIGURED');
    this.assertApplicationsEnabled(applications);
    const secrets = await this.getSecrets(targetId);
    if (!target.cnbRepository || !secrets.cnbToken)
      throw new BadRequestException('DEPLOYMENT_CNB_NOT_CONFIGURED');
    if (await this.hasActiveRun(targetId))
      throw new ConflictException('DEPLOYMENT_ALREADY_RUNNING');
    const steps: DeploymentRunStep[] = [
      {
        key: 'build',
        label: 'CNB 构建与测试',
        status: 'running',
        startedAt: new Date().toISOString(),
      },
      { key: 'registry', label: '推送应用镜像', status: 'pending' },
      { key: 'migration', label: '检查并执行数据库迁移', status: 'pending' },
      { key: 'release', label: 'Deploy Agent 更新服务', status: 'pending' },
      { key: 'health', label: '远程健康检查', status: 'pending' },
    ];
    let run = await this.createRunRecord(
      targetId,
      context.actorId,
      input.version,
      applications,
      steps,
    );
    try {
      const buildId = await this.triggerCnb(target, secrets.cnbToken, run);
      run = await this.updateRunBuildId(run.id, buildId);
      await this.audit.record({
        ...context,
        action: 'deployment.run.start',
        resource: 'deployment_run',
        resourceId: run.id,
        result: 'success',
        metadata: { targetId, version: input.version, applications },
      });
      return run;
    } catch (error) {
      await this.failRun(run.id, 'CNB_BUILD_TRIGGER_FAILED');
      await this.audit.record({
        ...context,
        action: 'deployment.run.start',
        resource: 'deployment_run',
        resourceId: run.id,
        result: 'failure',
        metadata: { targetId, version: input.version, applications },
      });
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('CNB_BUILD_TRIGGER_FAILED');
    }
  }

  private validateTarget(input: UpsertDeploymentTargetRequest): void {
    const applications = [...new Set(input.applications)];
    this.assertApplicationsEnabled(applications);
    if (!applications.includes('api')) throw new BadRequestException('DEPLOYMENT_API_REQUIRED');
    const requiredUrls = [
      applications.includes('admin') ? input.adminUrl : 'unused',
      input.apiUrl,
      applications.includes('web') ? input.webUrl : 'unused',
    ];
    if (requiredUrls.some((url) => !url))
      throw new BadRequestException('DEPLOYMENT_APPLICATION_URL_REQUIRED');
    if (input.accessMode === 'automatic_https') {
      if (requiredUrls.some((url) => !url?.startsWith('https://')))
        throw new BadRequestException('DEPLOYMENT_HTTPS_URL_REQUIRED');
    }
    for (const key of Object.keys(input.secrets))
      if (!secretKeys.includes(key as (typeof secretKeys)[number]))
        throw new BadRequestException('DEPLOYMENT_SECRET_FIELD_INVALID');
  }

  private assertApplicationsEnabled(applications: DeployableApplication[]): void {
    const enabled: DeployableApplication[] = ['admin', 'api'];
    if (project.modules.userWeb) enabled.push('web');
    if (applications.some((application) => !enabled.includes(application)))
      throw new BadRequestException('DEPLOYMENT_APPLICATION_DISABLED');
  }

  private cleanSecrets(input: UpsertDeploymentTargetRequest['secrets']): DeploymentSecrets {
    return Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => isSecretKey(key) && typeof value === 'string' && value.trim().length > 0,
      ),
    );
  }

  private async getSecrets(id: string): Promise<DeploymentSecrets> {
    if (!this.isPrisma()) {
      const row = memoryTargets.get(id);
      if (!row) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
      return decryptDeploymentSecrets(row.encryptedSecrets);
    }
    const row = await this.prisma.deploymentTarget.findUnique({
      where: { id },
      select: { encryptedSecrets: true },
    });
    if (!row) throw new NotFoundException('DEPLOYMENT_TARGET_NOT_FOUND');
    return decryptDeploymentSecrets(row.encryptedSecrets);
  }

  private targetFields(input: UpsertDeploymentTargetRequest) {
    return {
      name: input.name.trim(),
      environment: input.environment,
      applications: [...new Set(input.applications)],
      host: input.host.trim(),
      sshPort: input.sshPort,
      sshUser: input.sshUser.trim(),
      deployPath: input.deployPath,
      accessMode: input.accessMode,
      adminUrl: input.adminUrl?.trim() || null,
      apiUrl: input.apiUrl?.trim() || null,
      webUrl: input.webUrl?.trim() || null,
      cnbRepository: input.cnbRepository?.trim() || null,
      cnbEvent: input.cnbEvent?.trim() || 'api_trigger_deploy',
    };
  }

  private targetData(input: UpsertDeploymentTargetRequest, encryptedSecrets: string) {
    const fields = this.targetFields(input);
    return {
      ...fields,
      environment: environmentToPrisma[fields.environment],
      encryptedSecrets,
    };
  }

  private toTargetSummary(row: DeploymentTarget): DeploymentTargetSummary {
    return {
      id: row.id,
      name: row.name,
      environment: environmentFromPrisma[row.environment],
      applications: row.applications as DeployableApplication[],
      host: row.host,
      sshPort: row.sshPort,
      sshUser: row.sshUser,
      deployPath: row.deployPath,
      accessMode: row.accessMode as DeploymentTargetSummary['accessMode'],
      adminUrl: row.adminUrl,
      apiUrl: row.apiUrl,
      webUrl: row.webUrl,
      cnbRepository: row.cnbRepository,
      cnbEvent: row.cnbEvent,
      configuredSecrets: Object.keys(decryptDeploymentSecrets(row.encryptedSecrets)),
      status: statusFromPrisma[row.status],
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMemoryTargetSummary(row: MemoryTarget): DeploymentTargetSummary {
    const { encryptedSecrets, ...summary } = row;
    void encryptedSecrets;
    return summary;
  }

  private async hasActiveRun(targetId: string): Promise<boolean> {
    if (!this.isPrisma())
      return [...memoryRuns.values()].some(
        (run) =>
          run.targetId === targetId && ['queued', 'building', 'deploying'].includes(run.status),
      );
    return Boolean(
      await this.prisma.deploymentRun.findFirst({
        where: { targetId, status: { in: activeRunStatuses } },
        select: { id: true },
      }),
    );
  }

  private async createRunRecord(
    targetId: string,
    actorId: string,
    version: string,
    applications: DeployableApplication[],
    steps: DeploymentRunStep[],
  ): Promise<DeploymentRunSummary> {
    if (this.isPrisma()) {
      const row = await this.prisma.deploymentRun.create({
        data: {
          targetId,
          actorId,
          version,
          applications,
          status: PrismaRunStatus.BUILDING,
          currentStep: 'build',
          steps: steps as unknown as Prisma.InputJsonValue,
          startedAt: new Date(),
        },
      });
      return this.toRunSummary(row);
    }
    const now = new Date().toISOString();
    const run: DeploymentRunSummary = {
      id: randomUUID(),
      targetId,
      actorId,
      version,
      applications,
      status: 'building',
      currentStep: 'build',
      steps,
      cnbBuildId: null,
      errorCode: null,
      createdAt: now,
      startedAt: now,
      completedAt: null,
    };
    memoryRuns.set(run.id, run);
    return run;
  }

  private async triggerCnb(
    target: DeploymentTargetSummary,
    token: string,
    run: DeploymentRunSummary,
  ): Promise<string | null> {
    const repository = target.cnbRepository?.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`https://api.cnb.cool/${repository}/-/build/start`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: target.cnbEvent,
        env: {
          DEPLOYMENT_RUN_ID: run.id,
          DEPLOYMENT_TARGET_ID: target.id,
          DEPLOYMENT_VERSION: run.version,
          DEPLOYMENT_APPLICATIONS: run.applications.join(','),
          DEPLOYMENT_ADMIN_URL: target.adminUrl ?? '',
          DEPLOYMENT_API_URL: target.apiUrl ?? '',
          DEPLOYMENT_WEB_URL: target.webUrl ?? '',
        },
      }),
    });
    if (!response.ok) throw new BadGatewayException('CNB_BUILD_TRIGGER_FAILED');
    const body = (await response.json()) as Record<string, unknown>;
    const id = body['id'] ?? body['buildId'] ?? body['build_id'];
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
  }

  private async updateRunBuildId(
    id: string,
    buildId: string | null,
  ): Promise<DeploymentRunSummary> {
    if (this.isPrisma())
      return this.toRunSummary(
        await this.prisma.deploymentRun.update({ where: { id }, data: { cnbBuildId: buildId } }),
      );
    const run = memoryRuns.get(id);
    if (!run) throw new NotFoundException('DEPLOYMENT_RUN_NOT_FOUND');
    const updated = { ...run, cnbBuildId: buildId };
    memoryRuns.set(id, updated);
    return updated;
  }

  private async failRun(id: string, errorCode: string): Promise<void> {
    const completedAt = new Date();
    if (this.isPrisma()) {
      await this.prisma.deploymentRun.update({
        where: { id },
        data: { status: PrismaRunStatus.FAILED, errorCode, completedAt },
      });
      return;
    }
    const run = memoryRuns.get(id);
    if (run)
      memoryRuns.set(id, {
        ...run,
        status: 'failed',
        errorCode,
        completedAt: completedAt.toISOString(),
      });
  }

  private toRunSummary(row: DeploymentRun): DeploymentRunSummary {
    return {
      id: row.id,
      targetId: row.targetId,
      actorId: row.actorId,
      version: row.version,
      applications: row.applications as DeployableApplication[],
      status: runStatusFromPrisma[row.status],
      currentStep: row.currentStep,
      steps: row.steps as unknown as DeploymentRunStep[],
      cnbBuildId: row.cnbBuildId,
      errorCode: row.errorCode,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private isPrisma(): boolean {
    return process.env.DATA_SOURCE === 'prisma';
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
  }
}
