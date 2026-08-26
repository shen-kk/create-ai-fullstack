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
  type DeployProject,
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
  DeploymentProjectSummary,
  DeploymentUnitDefinition,
  DeploymentVariableDefinition,
  UpsertDeploymentProjectRequest,
  UpsertDeploymentEnvironmentRequest,
} from '@template/contracts';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeploymentCheckService } from './deployment-check.service.js';
import {
  decryptDeploymentSecrets,
  encryptDeploymentSecrets,
  safeDecryptDeploymentSecrets,
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
const secretKeys = [
  'gitToken',
  'gitSshPrivateKey',
  'sshPassword',
  'sshPrivateKey',
  'databaseUrl',
  'redisUrl',
  'jwtAccessSecret',
  'jwtRefreshSecret',
  'configEncryptionKey',
  'customerJwtAccessSecret',
  'customerJwtRefreshSecret',
] as const;
const activeStatuses = [
  PrismaRunStatus.QUEUED,
  PrismaRunStatus.RUNNING,
  PrismaRunStatus.ROLLING_BACK,
];
type EnvironmentWithProject = DeployEnvironment & { project: DeployProject };

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checker: DeploymentCheckService,
    private readonly audit: AuditService,
  ) {}

  async listProjects(): Promise<DeploymentProjectSummary[]> {
    const rows = await this.prisma.deployProject.findMany({
      include: { _count: { select: { environments: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.projectSummary(row, row._count.environments));
  }
  async getProject(id: string): Promise<DeploymentProjectSummary> {
    const row = await this.prisma.deployProject.findUnique({
      where: { id },
      include: { _count: { select: { environments: true } } },
    });
    if (!row) throw new NotFoundException('DEPLOYMENT_PROJECT_NOT_FOUND');
    return this.projectSummary(row, row._count.environments);
  }
  async createProject(
    input: UpsertDeploymentProjectRequest,
    context: AuditContext,
  ): Promise<DeploymentProjectSummary> {
    this.validateProject(input);
    try {
      const row = await this.prisma.deployProject.create({
        data: this.projectData(input),
      });
      await this.audit.record({
        ...context,
        action: 'deployment.project.create',
        resource: 'deploy_project',
        resourceId: row.id,
        result: 'success',
        metadata: { code: row.code, units: input.units.map((unit) => unit.key) },
      });
      return this.projectSummary(row, 0);
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('DEPLOYMENT_PROJECT_EXISTS');
      throw error;
    }
  }
  async updateProject(
    id: string,
    input: UpsertDeploymentProjectRequest,
    context: AuditContext,
  ): Promise<DeploymentProjectSummary> {
    this.validateProject(input);
    await this.requireProject(id);
    try {
      const row = await this.prisma.deployProject.update({
        where: { id },
        data: { ...this.projectData(input), version: { increment: 1 } },
      });
      await this.audit.record({
        ...context,
        action: 'deployment.project.update',
        resource: 'deploy_project',
        resourceId: id,
        result: 'success',
        metadata: { code: row.code, units: input.units.map((unit) => unit.key) },
      });
      const environmentCount = await this.prisma.deployEnvironment.count({
        where: { projectId: id },
      });
      return this.projectSummary(row, environmentCount);
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('DEPLOYMENT_PROJECT_EXISTS');
      throw error;
    }
  }

  async listEnvironments(): Promise<DeploymentEnvironmentSummary[]> {
    const rows = await this.prisma.deployEnvironment.findMany({
      include: { project: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.environmentSummary(row));
  }
  async getEnvironment(id: string): Promise<DeploymentEnvironmentSummary> {
    const row = await this.requireEnvironment(id);
    return this.environmentSummary(row);
  }
  async getEnvironmentSecrets(id: string, context: AuditContext): Promise<DeploymentSecrets> {
    const row = await this.requireEnvironment(id);
    try {
      const secrets = this.requiredDeploymentSecrets(row.encryptedSecrets);
      await this.audit.record({ ...context, action: 'deployment.secret.read', resource: 'deploy_environment', resourceId: id, result: 'success', metadata: { secretFields: Object.keys(secrets) } });
      return secrets;
    } catch (error) {
      await this.audit.record({ ...context, action: 'deployment.secret.read', resource: 'deploy_environment', resourceId: id, result: 'failure', metadata: {} });
      throw error;
    }
  }
  async createEnvironment(
    input: UpsertDeploymentEnvironmentRequest,
    context: AuditContext,
  ): Promise<DeploymentEnvironmentSummary> {
    input = await this.normalizeEnvironmentProject(await this.applyResourceBindings(input));
    await this.validateEnvironment(input);
    const secrets = this.cleanSecrets(input.secrets);
    await this.validateSecrets(input, secrets);
    try {
      const row = await this.prisma.deployEnvironment.create({
        data: this.environmentData(input, encryptDeploymentSecrets(secrets)),
        include: { project: true },
      });
      await this.audit.record({
        ...context,
        action: 'deployment.environment.create',
        resource: 'deploy_environment',
        resourceId: row.id,
        result: 'success',
        metadata: {
          kind: input.kind,
          projectId: input.projectId,
          applications: input.applications,
        },
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
    input = await this.normalizeEnvironmentProject(await this.applyResourceBindings(input));
    await this.validateEnvironment(input);
    const current = await this.requireEnvironment(id);
    const secrets = {
      ...safeDecryptDeploymentSecrets(current.encryptedSecrets),
      ...this.cleanSecrets(input.secrets),
    };
    await this.validateSecrets(input, secrets);
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
        include: { project: true },
      });
      await this.audit.record({
        ...context,
        action: 'deployment.environment.update',
        resource: 'deploy_environment',
        resourceId: id,
        result: 'success',
        metadata: {
          kind: input.kind,
          projectId: input.projectId,
          applications: input.applications,
        },
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
      this.requiredDeploymentSecrets(row.encryptedSecrets),
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
      this.requiredDeploymentSecrets(row.encryptedSecrets),
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
    const project = await this.requireProject(environment.projectId);
    const availableUnits = this.projectUnits(project).map((unit) => unit.key);
    const applications = [
      ...new Set(input.applications?.length ? input.applications : availableUnits),
    ];
    if (!applications.length || applications.some((item) => !availableUnits.includes(item)))
      throw new BadRequestException('DEPLOYMENT_APPLICATION_NOT_ALLOWED');
    const active = await this.prisma.deployRun.findFirst({
      where: { environmentId, status: { in: activeStatuses } },
    });
    if (active) throw new ConflictException('DEPLOYMENT_ALREADY_RUNNING');
    const labels = [
      ['prepare', '准备任务'],
      ['checkout', '获取代码'],
      ['build', '构建应用'],
      ...(this.projectUnits(project).some(
        (unit) => applications.includes(unit.key) && unit.migrationCommand,
      )
        ? ([['migrate', '数据库迁移']] as const)
        : []),
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
        executionSnapshot: this.executionSnapshot(project, environment, applications),
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
  private async requireEnvironment(id: string): Promise<EnvironmentWithProject> {
    const row = await this.prisma.deployEnvironment.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!row) throw new NotFoundException('DEPLOYMENT_ENVIRONMENT_NOT_FOUND');
    return row;
  }
  private async validateEnvironment(input: UpsertDeploymentEnvironmentRequest): Promise<void> {
    if (
      !input.name.trim() ||
      !input.repositoryUrl.trim() ||
      !input.gitRef.trim() ||
      !input.host.trim() ||
      !input.sshUser.trim() ||
      !input.deployPath.startsWith('/')
    )
      throw new BadRequestException('DEPLOYMENT_CONFIGURATION_INVALID');
    if (!input.applications?.length)
      throw new BadRequestException('DEPLOYMENT_APPLICATION_REQUIRED');
    if (!input.serverResourceId || !input.gitResourceId)
      throw new BadRequestException('DEPLOYMENT_RESOURCE_BINDING_REQUIRED');
    const project = await this.requireProject(input.projectId);
    const requiredKinds = new Set(
      this.projectVariables(project)
        .map((variable) => variable.resourceKind)
        .filter((kind): kind is 'sql' | 'redis' => kind === 'sql' || kind === 'redis'),
    );
    if (requiredKinds.has('sql') && !input.sqlResourceId)
      throw new BadRequestException('DEPLOYMENT_SQL_RESOURCE_REQUIRED');
    if (requiredKinds.has('redis') && !input.redisResourceId)
      throw new BadRequestException('DEPLOYMENT_REDIS_RESOURCE_REQUIRED');
    try {
      new URL(input.repositoryUrl);
    } catch {
      if (!/^git@[^:]+:.+/.test(input.repositoryUrl))
        throw new BadRequestException('DEPLOYMENT_REPOSITORY_URL_INVALID');
    }
  }
  private async applyResourceBindings(
    input: UpsertDeploymentEnvironmentRequest,
  ): Promise<UpsertDeploymentEnvironmentRequest> {
    const next = structuredClone(input);
    const load = async (id: string | undefined, kind: string) => {
      if (!id) return null;
      const resource = await this.prisma.serviceResource.findUnique({ where: { id } });
      if (!resource || resource.kind !== kind || !resource.enabled)
        throw new BadRequestException('DEPLOYMENT_RESOURCE_BINDING_INVALID');
      return resource;
    };
    const [server, git, sql, redis] = await Promise.all([
      load(input.serverResourceId, 'server'),
      load(input.gitResourceId, 'git'),
      load(input.sqlResourceId, 'sql'),
      load(input.redisResourceId, 'redis'),
    ]);
    if (server) {
      const values = server.values as Record<string, string>,
        secrets = this.requiredDeploymentSecrets(server.encryptedSecrets) as unknown as Record<
          string,
          string
        >;
      next.host = values.host ?? next.host;
      next.sshPort = Number(values.port || next.sshPort);
      next.sshUser = values.username ?? next.sshUser;
      next.sshAuthMode = (values.authMode as typeof next.sshAuthMode) ?? next.sshAuthMode;
      // 服务器资源中的路径是模板默认值；环境可以覆盖为实际部署路径。
      next.deployPath = next.deployPath || values.deployRoot || next.deployPath;
      next.secrets = { ...next.secrets };
      if (secrets.password) next.secrets.sshPassword = secrets.password;
      if (secrets.privateKey) next.secrets.sshPrivateKey = secrets.privateKey;
    }
    if (git) {
      const values = git.values as Record<string, string>,
        secrets = this.requiredDeploymentSecrets(git.encryptedSecrets) as unknown as Record<
          string,
          string
        >;
      next.repositoryUrl = values.repositoryUrl ?? next.repositoryUrl;
      next.gitRef = values.defaultRef ?? next.gitRef;
      next.gitAuthMode = (values.authMode as typeof next.gitAuthMode) ?? next.gitAuthMode;
      next.secrets = { ...next.secrets };
      if (secrets.token) next.secrets.gitToken = secrets.token;
      if (secrets.privateKey) next.secrets.gitSshPrivateKey = secrets.privateKey;
    }
    if (sql) {
      const values = sql.values as Record<string, string>,
        secrets = this.requiredDeploymentSecrets(sql.encryptedSecrets) as unknown as Record<
          string,
          string
        >;
      const databaseUrl =
        values.url ||
        `postgresql://${encodeURIComponent(values.username ?? '')}:${encodeURIComponent(secrets.password ?? '')}@${values.host}:${values.port}/${encodeURIComponent(values.database ?? '')}?schema=${encodeURIComponent(values.schema || 'public')}`;
      next.secrets = { ...next.secrets, databaseUrl };
    }
    if (redis) {
      const values = redis.values as Record<string, string>;
      const secrets = this.requiredDeploymentSecrets(redis.encryptedSecrets) as unknown as Record<
        string,
        string
      >;
      let target: URL;
      try {
        target = new URL(values.url ?? '');
      } catch {
        throw new BadRequestException('DEPLOYMENT_REDIS_URL_INVALID');
      }
      if (secrets.password) target.password = secrets.password;
      next.secrets = { ...next.secrets, redisUrl: target.toString() };
    }
    return next;
  }
  private async validateSecrets(
    input: UpsertDeploymentEnvironmentRequest,
    secrets: DeploymentSecrets,
  ): Promise<void> {
    if (input.gitAuthMode === 'token' && !secrets.gitToken)
      throw new BadRequestException('DEPLOYMENT_GIT_TOKEN_REQUIRED');
    if (input.gitAuthMode === 'ssh_key' && !secrets.gitSshPrivateKey)
      throw new BadRequestException('DEPLOYMENT_GIT_KEY_REQUIRED');
    if (input.sshAuthMode === 'password' && !secrets.sshPassword)
      throw new BadRequestException('DEPLOYMENT_SSH_PASSWORD_REQUIRED');
    if (input.sshAuthMode === 'private_key' && !secrets.sshPrivateKey)
      throw new BadRequestException('DEPLOYMENT_SSH_KEY_REQUIRED');
    const project = await this.requireProject(input.projectId);
    const compatibilityValues: Record<string, string | undefined> = {
      DATABASE_URL: secrets.databaseUrl,
      REDIS_URL: secrets.redisUrl,
      JWT_ACCESS_SECRET: secrets.jwtAccessSecret,
      JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
      CONFIG_ENCRYPTION_KEY: secrets.configEncryptionKey,
      CUSTOMER_JWT_ACCESS_SECRET: secrets.customerJwtAccessSecret,
      CUSTOMER_JWT_REFRESH_SECRET: secrets.customerJwtRefreshSecret,
      PUBLIC_API_BASE_URL: input.apiUrl,
    };
    const missing = this.projectVariables(project)
      .filter((variable) => variable.required)
      .filter((variable) =>
        variable.secret
          ? !(secrets.variables?.[variable.key] || compatibilityValues[variable.key])
          : !(input.values?.[variable.key] || compatibilityValues[variable.key]),
      )
      .map((variable) => variable.key);
    if (missing.length)
      throw new BadRequestException(`DEPLOYMENT_REQUIRED_VARIABLE_MISSING:${missing.join(',')}`);
  }
  private cleanSecrets(input: DeploymentSecrets): DeploymentSecrets {
    const result: DeploymentSecrets = {};
    for (const key of secretKeys) {
      const value = input[key]?.trim();
      if (value) result[key] = value;
    }
    const variables = Object.fromEntries(
      Object.entries(input.variables ?? {})
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value),
    );
    if (Object.keys(variables).length) result.variables = variables;
    return result;
  }
  private environmentData(
    input: UpsertDeploymentEnvironmentRequest,
    encryptedSecrets: string,
  ): Prisma.DeployEnvironmentUncheckedCreateInput {
    return {
      name: input.name.trim(),
      kind: kindToPrisma[input.kind],
      projectId: input.projectId,
      applications: [...new Set(input.applications ?? [])],
      environmentValues: input.values ?? {},
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
      serverResourceId: input.serverResourceId || null,
      gitResourceId: input.gitResourceId || null,
      sqlResourceId: input.sqlResourceId || null,
      redisResourceId: input.redisResourceId || null,
      encryptedSecrets,
    };
  }
  private environmentSummary(row: EnvironmentWithProject): DeploymentEnvironmentSummary {
    return {
      id: row.id,
      name: row.name,
      kind: kindFromPrisma[row.kind],
      projectId: row.projectId,
      projectName: row.project.name,
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
      serverResourceId: row.serverResourceId,
      gitResourceId: row.gitResourceId,
      sqlResourceId: row.sqlResourceId,
      redisResourceId: row.redisResourceId,
      values: row.environmentValues as Record<string, string>,
      configuredSecrets: secretKeys.filter((key) =>
        Boolean(safeDecryptDeploymentSecrets(row.encryptedSecrets)[key]),
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

  private async requireProject(id: string): Promise<DeployProject> {
    const project = await this.prisma.deployProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('DEPLOYMENT_PROJECT_NOT_FOUND');
    return project;
  }
  private async normalizeEnvironmentProject(
    input: UpsertDeploymentEnvironmentRequest,
  ): Promise<UpsertDeploymentEnvironmentRequest> {
    const project = await this.requireProject(input.projectId);
    const applications = this.projectUnits(project).map((unit) => unit.key);
    if (!applications.length) throw new BadRequestException('DEPLOYMENT_PROJECT_UNIT_REQUIRED');
    return { ...input, applications };
  }
  private validateProject(input: UpsertDeploymentProjectRequest): void {
    if (!input.name.trim() || !input.units.length || input.composeFile.includes('..'))
      throw new BadRequestException('DEPLOYMENT_PROJECT_INVALID');
    const unitKeys = input.units.map((unit) => unit.key);
    if (new Set(unitKeys).size !== unitKeys.length)
      throw new BadRequestException('DEPLOYMENT_PROJECT_UNIT_DUPLICATED');
    const variableKeys = input.variables.map((variable) => variable.key);
    if (new Set(variableKeys).size !== variableKeys.length)
      throw new BadRequestException('DEPLOYMENT_PROJECT_VARIABLE_DUPLICATED');
    if (input.units.some((unit) => /[\r\n\0]/.test(unit.migrationCommand ?? '')))
      throw new BadRequestException('DEPLOYMENT_PROJECT_COMMAND_INVALID');
  }
  private projectData(input: UpsertDeploymentProjectRequest): Prisma.DeployProjectCreateInput {
    return {
      name: input.name.trim(),
      code: input.code.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      composeFile: input.composeFile.trim(),
      units: input.units as unknown as Prisma.InputJsonValue,
      variables: input.variables as unknown as Prisma.InputJsonValue,
    };
  }
  private projectUnits(project: DeployProject): DeploymentUnitDefinition[] {
    return project.units as unknown as DeploymentUnitDefinition[];
  }
  private projectVariables(project: DeployProject): DeploymentVariableDefinition[] {
    return project.variables as unknown as DeploymentVariableDefinition[];
  }
  private projectSummary(
    project: DeployProject,
    environmentCount: number,
  ): DeploymentProjectSummary {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description,
      type: project.type as DeploymentProjectSummary['type'],
      composeFile: project.composeFile,
      units: this.projectUnits(project),
      variables: this.projectVariables(project),
      system: project.system,
      version: project.version,
      environmentCount,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
  private executionSnapshot(
    project: DeployProject,
    environment: DeployEnvironment,
    applications: string[],
  ): Prisma.InputJsonValue {
    return {
      schemaVersion: 1,
      project: {
        id: project.id,
        code: project.code,
        version: project.version,
        type: project.type,
        composeFile: project.composeFile,
        units: this.projectUnits(project).filter((unit) => applications.includes(unit.key)),
        variables: this.projectVariables(project),
      },
      environment: {
        id: environment.id,
        values: environment.environmentValues,
        resourceBindings: {
          sql: environment.sqlResourceId,
          redis: environment.redisResourceId,
        },
      },
      applications,
      createdAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;
  }
  private requiredDeploymentSecrets(value: string | null): DeploymentSecrets {
    try {
      return decryptDeploymentSecrets(value);
    } catch {
      throw new BadRequestException('DEPLOYMENT_SECRETS_REENTRY_REQUIRED');
    }
  }
}
