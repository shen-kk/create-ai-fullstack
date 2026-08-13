import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  DeployRunStatus,
  DeployStepStatus,
  type DeployEnvironment,
  type DeployRun,
} from '@prisma/client';
import { Client, type ConnectConfig } from 'ssh2';
import { PrismaService } from '../database/prisma.service.js';
import { decryptDeploymentSecrets } from './deployment-secrets.js';

const shell = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const terminalStatuses: DeployRunStatus[] = [
  DeployRunStatus.SUCCEEDED,
  DeployRunStatus.FAILED,
  DeployRunStatus.CANCELLED,
  DeployRunStatus.ROLLED_BACK,
];

@Injectable()
export class DeploymentWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DeploymentWorkerService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    if (process.env.DEPLOY_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), 1500);
    this.timer.unref();
    void this.tick();
  }
  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
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
        data: { status: DeployRunStatus.RUNNING, startedAt: new Date(), currentStep: 'prepare' },
      });
      if (claimed.count) await this.execute(queued, queued.environment);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
    }
  }

  private async execute(run: DeployRun, environment: DeployEnvironment): Promise<void> {
    const client = new Client();
    try {
      await this.step(run.id, 'prepare', 5, '正在连接服务器并检查运行环境');
      await this.connect(client, environment);
      await this.command(
        client,
        run.id,
        'command -v git >/dev/null && command -v docker >/dev/null && docker compose version >/dev/null && df -Pk / | tail -1',
      );
      await this.completeStep(run.id, 'prepare', 12, '服务器具备 Git、Docker 和 Docker Compose');
      if (run.releaseId) {
        await this.executeRollback(client, run, environment);
        return;
      }

      const release = `${new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14)}-${run.id.slice(-6)}`;
      const releasePath = `${environment.deployPath}/releases/${release}`;
      const secrets = decryptDeploymentSecrets(environment.encryptedSecrets);
      await this.step(run.id, 'checkout', 18, `正在获取 ${run.gitRef}`);
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
      await this.uploadRuntimeEnvironment(client, releasePath, environment, run.applications);
      const commitSha = (
        await this.command(client, run.id, `git -C ${shell(releasePath)} rev-parse HEAD`, false)
      ).trim();
      await this.prisma.deployRun.update({ where: { id: run.id }, data: { commitSha } });
      await this.completeStep(run.id, 'checkout', 28, `已获取提交 ${commitSha.slice(0, 12)}`);

      await this.step(run.id, 'build', 35, '正在构建所选应用');
      const services = run.applications.join(' ');
      const compose = `docker compose -p ${shell(`aiforge-${environment.id}`)} -f docker-compose.production.yml`;
      await this.command(
        client,
        run.id,
        `cd ${shell(releasePath)} && ${compose} build ${services}`,
      );
      await this.completeStep(run.id, 'build', 62, '容器镜像构建完成');
      if (run.applications.includes('api')) {
        await this.step(run.id, 'migrate', 64, '正在执行待应用的数据库迁移');
        await this.command(
          client,
          run.id,
          `cd ${shell(releasePath)} && ${compose} run --rm api ./node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma`,
        );
        await this.completeStep(run.id, 'migrate', 67, '数据库迁移完成');
      }
      await this.skipStep(run.id, 'upload', 68, '采用服务器端拉取与构建，无需上传制品');

      await this.step(run.id, 'start', 72, '正在启动新版本');
      await this.command(
        client,
        run.id,
        `cd ${shell(releasePath)} && ${compose} up -d --remove-orphans ${services}`,
      );
      await this.completeStep(run.id, 'start', 82, '新版本容器已启动');

      await this.step(run.id, 'health', 86, '正在执行健康检查');
      if (environment.healthCheckUrl)
        await this.command(
          client,
          run.id,
          `for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS --max-time 5 ${shell(environment.healthCheckUrl)} && exit 0; sleep 3; done; exit 1`,
        );
      else
        await this.command(
          client,
          run.id,
          `cd ${shell(releasePath)} && ${compose} ps --status running`,
        );
      await this.completeStep(run.id, 'health', 94, '健康检查通过');

      await this.step(run.id, 'switch', 96, '正在记录并切换当前版本');
      await this.command(
        client,
        run.id,
        `ln -sfn ${shell(releasePath)} ${shell(`${environment.deployPath}/current`)}`,
      );
      await this.assertActive(run.id);
      const releaseRow = await this.prisma.deployRelease.create({
        data: {
          environmentId: environment.id,
          version: release,
          commitSha,
          applications: run.applications,
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
          },
        }),
        this.prisma.deployStep.update({
          where: { runId_key: { runId: run.id, key: 'switch' } },
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
      const current = await this.prisma.deployRun.findUnique({ where: { id: run.id } });
      if (current && !terminalStatuses.includes(current.status)) {
        const message = this.safeMessage(error);
        await this.prisma.deployRun.update({
          where: { id: run.id },
          data: {
            status: DeployRunStatus.FAILED,
            errorCode: 'DEPLOYMENT_EXECUTION_FAILED',
            errorMessage: message,
            completedAt: new Date(),
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
    const compose = `docker compose -p ${shell(`aiforge-${environment.id}`)} -f docker-compose.production.yml`;
    await this.step(run.id, 'start', 40, `正在启动历史版本 ${release.version}`);
    await this.command(
      client,
      run.id,
      `test -f ${shell(`${releasePath}/docker-compose.production.yml`)} && cd ${shell(releasePath)} && ${compose} up -d --remove-orphans ${release.applications.join(' ')}`,
    );
    await this.completeStep(run.id, 'start', 70, '历史版本容器已启动');
    await this.step(run.id, 'health', 78, '正在检查回滚版本');
    if (environment.healthCheckUrl)
      await this.command(
        client,
        run.id,
        `for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS --max-time 5 ${shell(environment.healthCheckUrl)} && exit 0; sleep 3; done; exit 1`,
      );
    else
      await this.command(
        client,
        run.id,
        `cd ${shell(releasePath)} && ${compose} ps --status running`,
      );
    await this.completeStep(run.id, 'health', 90, '回滚版本健康检查通过');
    await this.step(run.id, 'switch', 95, '正在切换当前版本');
    await this.command(
      client,
      run.id,
      `ln -sfn ${shell(releasePath)} ${shell(`${environment.deployPath}/current`)}`,
    );
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
        },
      }),
      this.prisma.deployStep.update({
        where: { runId_key: { runId: run.id, key: 'switch' } },
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
      client.exec(command, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }
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
        stream.once('close', (code: number | null) =>
          code === 0
            ? resolve(stdout)
            : reject(new Error(stderr.trim() || `远程命令退出码 ${code ?? 'unknown'}`)),
        );
      }),
    );
  }
  private uploadRuntimeEnvironment(
    client: Client,
    releasePath: string,
    environment: DeployEnvironment,
    applications: string[],
  ): Promise<void> {
    const secrets = decryptDeploymentSecrets(environment.encryptedSecrets);
    if (applications.includes('api') && (!secrets.databaseUrl || !secrets.jwtAccessSecret || !secrets.jwtRefreshSecret || !secrets.configEncryptionKey))
      return Promise.reject(new Error('部署运行配置缺少 API 必填密钥'));
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      DATABASE_URL: secrets.databaseUrl ?? '',
      JWT_ACCESS_SECRET: secrets.jwtAccessSecret ?? '',
      JWT_REFRESH_SECRET: secrets.jwtRefreshSecret ?? '',
      CONFIG_ENCRYPTION_KEY: secrets.configEncryptionKey ?? '',
      CUSTOMER_JWT_ACCESS_SECRET: secrets.customerJwtAccessSecret ?? '',
      CUSTOMER_JWT_REFRESH_SECRET: secrets.customerJwtRefreshSecret ?? '',
      ADMIN_ORIGIN: environment.adminUrl ?? process.env.ADMIN_ORIGIN ?? '',
      WEB_ORIGIN: environment.webUrl ?? process.env.WEB_ORIGIN ?? '',
      PUBLIC_API_BASE_URL: environment.apiUrl ?? process.env.PUBLIC_API_BASE_URL ?? '',
      ADMIN_PORT: process.env.ADMIN_PORT ?? '3000',
      API_PORT: process.env.API_PORT ?? '3001',
      WEB_PORT: process.env.WEB_PORT ?? '3002',
    };
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
  private async skipStep(
    runId: string,
    key: string,
    progress: number,
    message: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.deployRun.update({ where: { id: runId }, data: { progress } }),
      this.prisma.deployStep.update({
        where: { runId_key: { runId, key } },
        data: { status: DeployStepStatus.SKIPPED, progress: 100, message, completedAt: new Date() },
      }),
    ]);
  }
  private async log(runId: string, level: 'info' | 'warn' | 'error', raw: string): Promise<void> {
    const message = raw.replace(/[\r\n]+$/g, '').slice(0, 8000);
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
  private safeMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.replace(/(token|password|private.?key)=?[^\s]*/gi, '$1=***').slice(0, 1000) ||
      '部署执行失败'
    );
  }
  private async assertActive(runId: string): Promise<void> {
    const run = await this.prisma.deployRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    if (!run || run.status !== DeployRunStatus.RUNNING) throw new Error('部署任务已取消或不再执行');
  }
}
