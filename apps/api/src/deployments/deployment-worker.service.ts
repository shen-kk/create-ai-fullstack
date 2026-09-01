import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { DeploymentExecutionSnapshot, DeploymentExecutionUnit } from '@template/contracts';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import {
  DeployRunStatus,
  DeployStepStatus,
  type DeployEnvironment,
  type DeployRun,
} from '@prisma/client';
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2';
import { PrismaService } from '../database/prisma.service.js';
import { decryptDeploymentSecrets } from './deployment-secrets.js';
import { parseDeploymentExecutionSnapshot } from './deployment-execution-snapshot.js';
import { deploymentErrorCode, deploymentErrorMessage } from './deployment-error.js';
import { deploymentSecretValues, redactDeploymentLog } from './deployment-log-redaction.js';
import {
  deploymentBuildCommand,
  deploymentBuildHeapMb,
  deploymentMinimumAvailableMb,
  deploymentResourceCheckCommand,
} from './deployment-resource-policy.js';
import {
  deploymentCommandTimeoutMs,
  deploymentWorkerHeartbeatMs,
  deploymentWorkerLeaseMs,
  deploymentWorkerLegacyStaleMs,
} from './deployment-worker-lease.js';
import {
  atomicReleaseSwitchCommand,
  deploymentHealthCheckCommand,
  deploymentReleaseCommand,
  shellQuote as shell,
} from './deployment-release-commands.js';

const terminalStatuses: DeployRunStatus[] = [
  DeployRunStatus.SUCCEEDED,
  DeployRunStatus.FAILED,
  DeployRunStatus.CANCELLED,
  DeployRunStatus.ROLLED_BACK,
];

@Injectable()
export class DeploymentWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DeploymentWorkerService.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private readonly activeChannels = new Map<string, ClientChannel>();
  private readonly sensitiveValues = new Map<string, string[]>();
  private timer?: NodeJS.Timeout;
  private workerHeartbeatTimer?: NodeJS.Timeout;
  private busy = false;
  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    if (process.env.DEPLOY_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), 1500);
    this.workerHeartbeatTimer = setInterval(
      () => void this.touchWorker().catch((error: unknown) => this.logWorkerError(error)),
      10_000,
    );
    void this.registerWorker().catch((error: unknown) => this.logWorkerError(error));
    void this.recoverStaleRuns();
    void this.tick();
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.workerHeartbeatTimer) clearInterval(this.workerHeartbeatTimer);
    await this.prisma.deployWorker.deleteMany({ where: { id: this.workerId } });
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const queued = await this.prisma.deployRun.findFirst({
        where: { status: DeployRunStatus.QUEUED },
        orderBy: { createdAt: 'asc' },
        include: { environment: true },
      });
      if (!queued) return;
      const claimed = await this.prisma.deployRun.updateMany({
        where: { id: queued.id, status: DeployRunStatus.QUEUED },
        data: {
          status: DeployRunStatus.RUNNING,
          startedAt: new Date(),
          currentStep: 'prepare',
          workerId: this.workerId,
          claimedAt: new Date(),
          heartbeatAt: new Date(),
          leaseExpiresAt: this.nextLeaseExpiry(),
          attempt: { increment: 1 },
        },
      });
      if (claimed.count) {
        this.logger.log(`已领取部署任务 ${queued.id}，开始执行`);
        await this.touchWorker(queued.id);
        const stopHeartbeat = this.startHeartbeat(queued.id);
        try {
          await this.execute(queued, queued.environment);
        } finally {
          stopHeartbeat();
          await this.touchWorker(null);
        }
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
    }
  }

  /**
   * A worker process can be terminated while an SSH command is running. In
   * that case the database row remains RUNNING forever and prevents future
   * deployments for the environment. Recover only runs older than the
   * configured safety window; normal long-running builds remain untouched.
   */
  private async recoverStaleRuns(): Promise<void> {
    const legacyBefore = new Date(Date.now() - this.legacyStaleTimeoutMs());
    const now = new Date();
    const stale = await this.prisma.deployRun.findMany({
      where: {
        status: { in: [DeployRunStatus.RUNNING, DeployRunStatus.ROLLING_BACK] },
        OR: [
          { leaseExpiresAt: { lt: now } },
          { leaseExpiresAt: null, startedAt: { lt: legacyBefore } },
        ],
      },
      select: { id: true, currentStep: true },
      take: 100,
    });
    for (const run of stale) {
      const result = await this.prisma.deployRun.updateMany({
        where: {
          id: run.id,
          status: { in: [DeployRunStatus.RUNNING, DeployRunStatus.ROLLING_BACK] },
        },
        data: {
          status: DeployRunStatus.FAILED,
          errorCode: 'DEPLOYMENT_WORKER_INTERRUPTED',
          errorMessage: '部署执行器长时间未上报进度，任务已标记失败，可重新部署。',
          completedAt: new Date(),
          currentStep: null,
          workerId: null,
          leaseExpiresAt: null,
        },
      });
      if (result.count && run.currentStep) {
        await this.prisma.deployStep.updateMany({
          where: { runId: run.id, key: run.currentStep },
          data: {
            status: DeployStepStatus.FAILED,
            message: '执行器中断，任务已自动终止',
            completedAt: new Date(),
          },
        });
      }
    }
    if (stale.length) this.logger.warn(`已恢复 ${stale.length} 个中断的部署任务`);
  }

  private async execute(run: DeployRun, environment: DeployEnvironment): Promise<void> {
    const client = new Client();
    let previousTarget = '';
    let switched = false;
    let selectedUnits: DeploymentExecutionUnit[] = [];
    try {
      this.sensitiveValues.set(
        run.id,
        deploymentSecretValues(decryptDeploymentSecrets(environment.encryptedSecrets)),
      );
      await this.step(run.id, 'prepare', 5, '正在连接服务器并检查运行环境');
      await this.connect(client, environment);
      const runtime = await this.command(
        client,
        run.id,
        'set -e; command -v git >/dev/null; command -v curl >/dev/null; command -v node >/dev/null; command -v pnpm >/dev/null; command -v pm2 >/dev/null; printf "git "; git --version; printf "node "; node --version; printf "pnpm "; pnpm --version; printf "pm2 "; pm2 --version; df -Pk / | tail -1',
      );
      const runtimeSummary = runtime.trim().split(/\r?\n/).filter(Boolean).slice(0, 5).join(' · ');
      if (run.releaseId) {
        await this.completeStep(run.id, 'prepare', 10, `服务器运行环境：${runtimeSummary}`);
        await this.executeRollback(client, run, environment);
        return;
      }
      const resourceSummary = await this.command(
        client,
        run.id,
        deploymentResourceCheckCommand(this.minimumAvailableMb()),
      );
      await this.completeStep(
        run.id,
        'prepare',
        10,
        `服务器运行环境：${runtimeSummary} · ${resourceSummary.trim()}`,
      );

      const release = `${new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14)}-${run.id.slice(-6)}`;
      const releasePath = `${environment.deployPath}/releases/${release}`;
      const secrets = decryptDeploymentSecrets(environment.encryptedSecrets);
      await this.step(run.id, 'checkout', 14, `正在获取 ${run.gitRef}`);
      await this.command(
        client,
        run.id,
        `mkdir -p ${shell(`${environment.deployPath}/releases`)} && rm -rf ${shell(releasePath)}`,
      );
      const clone = this.gitCloneCommand(
        environment,
        run.gitRef,
        releasePath,
        secrets.gitToken,
        secrets.gitSshPrivateKey,
      );
      await this.command(client, run.id, clone.command);
      if (clone.cleanup) await this.command(client, run.id, clone.cleanup);
      const snapshot = this.snapshot(run);
      await this.uploadRuntimeEnvironment(client, releasePath, environment, run, snapshot);
      const commitSha = (
        await this.command(client, run.id, `git -C ${shell(releasePath)} rev-parse HEAD`, false)
      ).trim();
      await this.prisma.deployRun.update({ where: { id: run.id }, data: { commitSha } });
      await this.completeStep(run.id, 'checkout', 24, `已获取提交 ${commitSha.slice(0, 12)}`);

      selectedUnits = snapshot.project.units.filter((unit) => run.applications.includes(unit.key));
      if (!selectedUnits.length) throw new Error('未选择可部署的应用单元');
      await this.step(run.id, 'install', 28, '正在安装锁定依赖');
      await this.command(
        client,
        run.id,
        deploymentReleaseCommand(
          releasePath,
          deploymentBuildCommand(snapshot.project.installCommand, this.buildHeapMb()),
        ),
      );
      await this.command(
        client,
        run.id,
        deploymentReleaseCommand(
          releasePath,
          deploymentBuildCommand('pnpm db:generate', this.buildHeapMb()),
        ),
      );
      await this.completeStep(run.id, 'install', 42, '依赖安装完成');
      await this.step(run.id, 'build', 46, '正在构建所选应用');
      await this.command(
        client,
        run.id,
        deploymentReleaseCommand(
          releasePath,
          deploymentBuildCommand('pnpm --filter @template/contracts build', this.buildHeapMb()),
        ),
      );
      await this.log(run.id, 'info', '共享 contracts 构建完成');
      for (const unit of selectedUnits)
        await this.command(
          client,
          run.id,
          deploymentReleaseCommand(
            releasePath,
            deploymentBuildCommand(unit.buildCommand, this.buildHeapMb()),
          ),
        );
      await this.completeStep(run.id, 'build', 64, '应用构建完成');
      const migrations = selectedUnits.filter((unit) => unit.migrationCommand);
      if (migrations.length) {
        await this.step(run.id, 'migrate', 64, '正在执行待应用的数据库迁移');
        for (const unit of migrations)
          await this.command(
            client,
            run.id,
            deploymentReleaseCommand(releasePath, unit.migrationCommand!),
          );
        await this.completeStep(run.id, 'migrate', 70, '数据库迁移完成');
      }
      await this.step(run.id, 'switch', 74, '正在原子切换当前版本');
      previousTarget = (
        await this.command(
          client,
          run.id,
          `readlink -f ${shell(`${environment.deployPath}/current`)} 2>/dev/null || true`,
          false,
        )
      ).trim();
      await this.command(
        client,
        run.id,
        atomicReleaseSwitchCommand(environment.deployPath, releasePath),
      );
      switched = true;
      await this.completeStep(run.id, 'switch', 78, '当前目录已切换到新版本');

      await this.step(run.id, 'restart', 80, '正在重启所选应用');
      for (const unit of selectedUnits)
        await this.command(
          client,
          run.id,
          deploymentReleaseCommand(`${environment.deployPath}/current`, unit.restartCommand),
        );
      await this.completeStep(run.id, 'restart', 88, '应用重启完成');

      await this.step(run.id, 'health', 90, '正在执行健康检查');
      const healthUrls = [
        environment.healthCheckUrl,
        ...selectedUnits.map((unit) => unit.healthCheckUrl),
      ].filter((value): value is string => Boolean(value));
      if (healthUrls.length)
        for (const url of [...new Set(healthUrls)])
          await this.command(client, run.id, deploymentHealthCheckCommand(url));
      else
        await this.command(client, run.id, `test -L ${shell(`${environment.deployPath}/current`)}`);
      await this.completeStep(run.id, 'health', 94, '健康检查通过');

      await this.step(run.id, 'finalize', 96, '正在记录发布版本');
      await this.assertActive(run.id);
      const releaseRow = await this.prisma.deployRelease.create({
        data: {
          environmentId: environment.id,
          version: release,
          commitSha,
          applications: run.applications,
          ...(run.executionSnapshot ? { executionSnapshot: run.executionSnapshot } : {}),
        },
      });
      await this.prisma.$transaction([
        this.prisma.deployEnvironment.update({
          where: { id: environment.id },
          data: { currentReleaseId: releaseRow.id },
        }),
        this.prisma.deployRun.update({
          where: { id: run.id },
          data: {
            status: DeployRunStatus.SUCCEEDED,
            progress: 100,
            currentStep: null,
            releaseId: releaseRow.id,
            completedAt: new Date(),
            workerId: null,
            leaseExpiresAt: null,
          },
        }),
        this.prisma.deployStep.update({
          where: { runId_key: { runId: run.id, key: 'finalize' } },
          data: {
            status: DeployStepStatus.SUCCEEDED,
            progress: 100,
            message: `当前版本 ${release}`,
            completedAt: new Date(),
          },
        }),
      ]);
      await this.log(run.id, 'info', `部署成功：${release} (${commitSha.slice(0, 12)})`);
    } catch (error) {
      if (switched) {
        try {
          if (previousTarget) {
            await this.command(
              client,
              run.id,
              atomicReleaseSwitchCommand(environment.deployPath, previousTarget),
            );
            for (const unit of selectedUnits)
              await this.command(
                client,
                run.id,
                deploymentReleaseCommand(`${environment.deployPath}/current`, unit.restartCommand),
              );
            await this.log(run.id, 'warn', '新版本失败，已自动恢复上一运行版本');
          } else {
            await this.command(
              client,
              run.id,
              `rm -f ${shell(`${environment.deployPath}/current`)}`,
            );
          }
        } catch (rollbackError) {
          await this.log(
            run.id,
            'error',
            `自动恢复失败：${this.safeMessage(rollbackError, run.id)}`,
          );
        }
      }
      const current = await this.prisma.deployRun.findUnique({ where: { id: run.id } });
      if (
        current &&
        current.workerId === this.workerId &&
        !terminalStatuses.includes(current.status)
      ) {
        const message = this.safeMessage(error, run.id);
        await this.prisma.deployRun.update({
          where: { id: run.id },
          data: {
            status: DeployRunStatus.FAILED,
            errorCode: deploymentErrorCode(current.currentStep, error),
            errorMessage: message,
            completedAt: new Date(),
            workerId: null,
            leaseExpiresAt: null,
          },
        });
        if (current.currentStep)
          await this.prisma.deployStep.updateMany({
            where: { runId: run.id, key: current.currentStep },
            data: { status: DeployStepStatus.FAILED, message, completedAt: new Date() },
          });
        await this.log(run.id, 'error', message);
      }
    } finally {
      this.sensitiveValues.delete(run.id);
      client.end();
    }
  }

  private connect(client: Client, environment: DeployEnvironment): Promise<void> {
    const secrets = decryptDeploymentSecrets(environment.encryptedSecrets);
    const credential =
      environment.sshAuthMode === 'password' ? secrets.sshPassword : secrets.sshPrivateKey;
    if (!credential) return Promise.reject(new Error('SSH 凭据未配置'));
    const config: ConnectConfig = {
      host: environment.host,
      port: environment.sshPort,
      username: environment.sshUser,
      readyTimeout: 15_000,
      keepaliveInterval: 10_000,
      ...(environment.sshAuthMode === 'password'
        ? { password: credential }
        : { privateKey: credential }),
    };
    return new Promise((resolve, reject) => {
      client.once('ready', resolve).once('error', reject).connect(config);
    });
  }
  private async executeRollback(
    client: Client,
    run: DeployRun,
    environment: DeployEnvironment,
  ): Promise<void> {
    const release = await this.prisma.deployRelease.findFirst({
      where: { id: run.releaseId ?? '', environmentId: environment.id },
    });
    if (!release) throw new Error('目标回滚版本不存在');
    const releasePath = `${environment.deployPath}/releases/${release.version}`;
    const snapshot = this.snapshot(run);
    const units = snapshot.project.units.filter((unit) => release.applications.includes(unit.key));
    const previousTarget = (
      await this.command(
        client,
        run.id,
        `readlink -f ${shell(`${environment.deployPath}/current`)} 2>/dev/null || true`,
        false,
      )
    ).trim();
    await this.step(run.id, 'switch', 40, `正在切换到历史版本 ${release.version}`);
    await this.command(client, run.id, `test -d ${shell(releasePath)}`);
    await this.command(
      client,
      run.id,
      atomicReleaseSwitchCommand(environment.deployPath, releasePath),
    );
    try {
      await this.completeStep(run.id, 'switch', 55, '历史版本目录切换完成');
      await this.step(run.id, 'restart', 60, '正在重启历史版本');
      for (const unit of units)
        await this.command(
          client,
          run.id,
          deploymentReleaseCommand(`${environment.deployPath}/current`, unit.restartCommand),
        );
      await this.completeStep(run.id, 'restart', 75, '历史版本已重启');
      await this.step(run.id, 'health', 80, '正在检查回滚版本');
      const healthUrls = [
        environment.healthCheckUrl,
        ...units.map((unit) => unit.healthCheckUrl),
      ].filter((value): value is string => Boolean(value));
      for (const url of [...new Set(healthUrls)])
        await this.command(client, run.id, deploymentHealthCheckCommand(url));
      await this.completeStep(run.id, 'health', 90, '回滚版本健康检查通过');
    } catch (error) {
      if (previousTarget) {
        await this.command(
          client,
          run.id,
          atomicReleaseSwitchCommand(environment.deployPath, previousTarget),
        );
        for (const unit of units)
          await this.command(
            client,
            run.id,
            deploymentReleaseCommand(`${environment.deployPath}/current`, unit.restartCommand),
          );
      }
      throw error;
    }
    await this.assertActive(run.id);
    await this.prisma.$transaction([
      this.prisma.deployEnvironment.update({
        where: { id: environment.id },
        data: { currentReleaseId: release.id },
      }),
      this.prisma.deployRun.update({
        where: { id: run.id },
        data: {
          status: DeployRunStatus.ROLLED_BACK,
          progress: 100,
          currentStep: null,
          completedAt: new Date(),
          workerId: null,
          leaseExpiresAt: null,
        },
      }),
      this.prisma.deployStep.update({
        where: { runId_key: { runId: run.id, key: 'health' } },
        data: {
          status: DeployStepStatus.SUCCEEDED,
          progress: 100,
          message: `已回滚到 ${release.version}`,
          completedAt: new Date(),
        },
      }),
    ]);
    await this.log(run.id, 'info', `回滚成功：${release.version}`);
  }
  private command(
    client: Client,
    runId: string,
    command: string,
    writeLog = true,
  ): Promise<string> {
    return new Promise((resolve, reject) =>
      client.exec(
        `bash -lc ${shell(`export PATH="$(npm prefix -g)/bin:$PATH"; nice -n 15 bash -c ${shell(command)}`)}`,
        (error, stream) => {
          if (error) {
            reject(error);
            return;
          }
          this.activeChannels.set(runId, stream);
          const timeout = setTimeout(() => {
            stream.close();
            reject(new Error('DEPLOYMENT_COMMAND_TIMEOUT'));
          }, this.commandTimeoutMs());
          let stdout = '',
            stderr = '';
          stream.on('data', (chunk: Buffer) => {
            const value = chunk.toString();
            stdout += value;
            if (writeLog) void this.log(runId, 'info', value);
          });
          stream.stderr.on('data', (chunk: Buffer) => {
            const value = chunk.toString();
            stderr += value;
            if (writeLog) void this.log(runId, 'warn', value);
          });
          stream.once('close', (code: number | null) => {
            clearTimeout(timeout);
            this.activeChannels.delete(runId);
            if (code === 0) {
              resolve(stdout);
              return;
            }
            const detail = (stderr.trim() || stdout.trim()).slice(-8000);
            reject(new Error(detail || `远程命令退出码 ${code ?? 'unknown'}`));
          });
        },
      ),
    );
  }
  private uploadRuntimeEnvironment(
    client: Client,
    releasePath: string,
    environment: DeployEnvironment,
    run: DeployRun,
    snapshot: DeploymentExecutionSnapshot,
  ): Promise<void> {
    const secrets = decryptDeploymentSecrets(environment.encryptedSecrets);
    const databaseValues: Record<string, string> = {};
    if (secrets.databaseUrl) {
      try {
        const databaseUrl = new URL(secrets.databaseUrl);
        if (databaseUrl.protocol === 'postgresql:' || databaseUrl.protocol === 'postgres:') {
          if (databaseUrl.username)
            databaseValues.POSTGRES_USER = decodeURIComponent(databaseUrl.username);
          if (databaseUrl.password)
            databaseValues.POSTGRES_PASSWORD = decodeURIComponent(databaseUrl.password);
          if (databaseUrl.pathname.slice(1))
            databaseValues.POSTGRES_DB = decodeURIComponent(databaseUrl.pathname.slice(1));
        }
      } catch {
        // DATABASE_URL 的格式校验由 API/迁移步骤负责，这里不阻断其他变量写入。
      }
    }
    const values: Record<string, string> = {
      ...(environment.environmentValues as Record<string, string>),
      NODE_ENV: 'production',
      DATABASE_URL: secrets.databaseUrl ?? '',
      REDIS_URL: secrets.redisUrl ?? '',
      JWT_ACCESS_SECRET: secrets.jwtAccessSecret ?? '',
      JWT_REFRESH_SECRET: secrets.jwtRefreshSecret ?? '',
      CONFIG_ENCRYPTION_KEY: secrets.configEncryptionKey ?? '',
      CUSTOMER_JWT_ACCESS_SECRET: secrets.customerJwtAccessSecret ?? '',
      CUSTOMER_JWT_REFRESH_SECRET: secrets.customerJwtRefreshSecret ?? '',
      ADMIN_ORIGIN:
        environment.adminUrl ?? process.env.ADMIN_ORIGIN ?? `http://${environment.host}:3000`,
      WEB_ORIGIN: environment.webUrl ?? process.env.WEB_ORIGIN ?? `http://${environment.host}:3002`,
      PUBLIC_API_BASE_URL:
        (environment.environmentValues as Record<string, string>).PUBLIC_API_BASE_URL ??
        environment.apiUrl ??
        process.env.PUBLIC_API_BASE_URL ??
        '',
      ADMIN_PORT: process.env.ADMIN_PORT ?? '3000',
      API_PORT: process.env.API_PORT ?? '3001',
      WEB_PORT: process.env.WEB_PORT ?? '3002',
      ...databaseValues,
      ...(secrets.variables ?? {}),
    };
    const missing = snapshot.project.variables
      .filter((variable) => variable.required && !values[variable.key])
      .map((variable) => variable.key);
    if (missing.length)
      return Promise.reject(new Error(`部署运行配置缺少必填变量：${missing.join('、')}`));
    const body = `${Object.entries(values)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join('\n')}\n`;
    return new Promise((resolve, reject) =>
      client.sftp((error, sftp) => {
        if (error) {
          reject(error);
          return;
        }
        sftp.writeFile(`${releasePath}/.env`, Buffer.from(body), { mode: 0o600 }, (writeError) =>
          writeError ? reject(writeError) : resolve(),
        );
      }),
    );
  }
  private snapshot(run: DeployRun): DeploymentExecutionSnapshot {
    if (!run.executionSnapshot) throw new Error('部署任务缺少执行快照，请重新创建任务');
    return parseDeploymentExecutionSnapshot(run.executionSnapshot);
  }

  private gitCloneCommand(
    environment: DeployEnvironment,
    ref: string,
    path: string,
    token?: string,
    privateKey?: string,
  ): { command: string; cleanup?: string } {
    const base = `git clone --depth 1 --branch ${shell(ref)} ${shell(environment.repositoryUrl)} ${shell(path)}`;
    if (environment.gitAuthMode === 'token' && token) {
      const auth = Buffer.from(`oauth2:${token}`).toString('base64');
      return {
        command: `git -c http.extraHeader=${shell(`Authorization: Basic ${auth}`)} clone --depth 1 --branch ${shell(ref)} ${shell(environment.repositoryUrl)} ${shell(path)}`,
      };
    }
    if (environment.gitAuthMode === 'ssh_key' && privateKey) {
      const keyPath = `/tmp/aiforge-git-${Date.now()}`;
      const encoded = Buffer.from(privateKey).toString('base64');
      return {
        command: `printf %s ${shell(encoded)} | base64 -d > ${shell(keyPath)} && chmod 600 ${shell(keyPath)} && GIT_SSH_COMMAND=${shell(`ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`)} ${base}`,
        cleanup: `rm -f ${shell(keyPath)}`,
      };
    }
    return { command: base };
  }
  private async step(runId: string, key: string, progress: number, message: string): Promise<void> {
    await this.assertActive(runId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.deployRun.update({ where: { id: runId }, data: { currentStep: key, progress } }),
      this.prisma.deployStep.update({
        where: { runId_key: { runId, key } },
        data: { status: DeployStepStatus.RUNNING, progress, message, startedAt: now },
      }),
    ]);
    await this.log(runId, 'info', message);
  }
  private async completeStep(
    runId: string,
    key: string,
    progress: number,
    message: string,
  ): Promise<void> {
    await this.assertActive(runId);
    await this.prisma.$transaction([
      this.prisma.deployRun.update({ where: { id: runId }, data: { progress } }),
      this.prisma.deployStep.update({
        where: { runId_key: { runId, key } },
        data: {
          status: DeployStepStatus.SUCCEEDED,
          progress: 100,
          message,
          completedAt: new Date(),
        },
      }),
    ]);
    await this.log(runId, 'info', message);
  }
  private async log(runId: string, level: 'info' | 'warn' | 'error', raw: string): Promise<void> {
    const message = redactDeploymentLog(raw, this.sensitiveValues.get(runId) ?? [])
      .replace(/[\r\n]+$/g, '')
      .slice(0, 8000);
    if (!message) return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const last = await this.prisma.deployLog.aggregate({
        where: { runId },
        _max: { sequence: true },
      });
      try {
        await this.prisma.deployLog.create({
          data: { runId, sequence: (last._max.sequence ?? 0) + 1, level, message },
        });
        return;
      } catch {
        /* retry sequence race */
      }
    }
  }
  private safeMessage(error: unknown, runId: string): string {
    const stableMessage = deploymentErrorMessage(error);
    if (stableMessage) return stableMessage;
    const message = error instanceof Error ? error.message : String(error);
    return (
      redactDeploymentLog(message, this.sensitiveValues.get(runId) ?? []).slice(0, 1000) ||
      '部署执行失败'
    );
  }
  private async assertActive(runId: string): Promise<void> {
    const run = await this.prisma.deployRun.findUnique({
      where: { id: runId },
      select: { status: true, workerId: true, leaseExpiresAt: true },
    });
    if (
      !run ||
      run.status !== DeployRunStatus.RUNNING ||
      run.workerId !== this.workerId ||
      !run.leaseExpiresAt ||
      run.leaseExpiresAt <= new Date()
    )
      throw new Error('部署任务已取消、租约已失效或不再由当前执行器持有');
  }

  private leaseDurationMs(): number {
    return deploymentWorkerLeaseMs(process.env.DEPLOY_WORKER_LEASE_MS);
  }

  private heartbeatIntervalMs(): number {
    return deploymentWorkerHeartbeatMs(this.leaseDurationMs());
  }

  private legacyStaleTimeoutMs(): number {
    return deploymentWorkerLegacyStaleMs(process.env.DEPLOY_WORKER_STALE_TIMEOUT_MS);
  }

  private commandTimeoutMs(): number {
    return deploymentCommandTimeoutMs(process.env.DEPLOY_WORKER_COMMAND_TIMEOUT_MS);
  }

  private buildHeapMb(): number {
    return deploymentBuildHeapMb(process.env.DEPLOY_BUILD_MAX_OLD_SPACE_MB);
  }

  private minimumAvailableMb(): number {
    return deploymentMinimumAvailableMb(process.env.DEPLOY_MIN_AVAILABLE_MEMORY_MB);
  }

  private nextLeaseExpiry(): Date {
    return new Date(Date.now() + this.leaseDurationMs());
  }

  private startHeartbeat(runId: string): () => void {
    const heartbeat = async (): Promise<void> => {
      const result = await this.prisma.deployRun.updateMany({
        where: {
          id: runId,
          workerId: this.workerId,
          status: { in: [DeployRunStatus.RUNNING, DeployRunStatus.ROLLING_BACK] },
        },
        data: { heartbeatAt: new Date(), leaseExpiresAt: this.nextLeaseExpiry() },
      });
      await this.touchWorker(runId);
      if (!result.count) this.activeChannels.get(runId)?.close();
    };
    const timer = setInterval(
      () => void heartbeat().catch((error: unknown) => this.logWorkerError(error)),
      this.heartbeatIntervalMs(),
    );
    return () => clearInterval(timer);
  }

  private registerWorker(): Promise<unknown> {
    return this.prisma.deployWorker.upsert({
      where: { id: this.workerId },
      create: {
        id: this.workerId,
        hostname: hostname(),
        processId: process.pid,
        version: process.env.npm_package_version ?? 'unknown',
      },
      update: {
        hostname: hostname(),
        processId: process.pid,
        version: process.env.npm_package_version ?? 'unknown',
        lastHeartbeatAt: new Date(),
      },
    });
  }

  private touchWorker(currentRunId?: string | null): Promise<unknown> {
    return this.prisma.deployWorker.updateMany({
      where: { id: this.workerId },
      data: {
        lastHeartbeatAt: new Date(),
        ...(currentRunId !== undefined ? { currentRunId } : {}),
      },
    });
  }

  private logWorkerError(error: unknown): void {
    this.logger.error(error instanceof Error ? error.message : String(error));
  }
}
