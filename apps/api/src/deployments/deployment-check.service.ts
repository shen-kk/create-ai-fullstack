import { Injectable } from '@nestjs/common';
import type { DeploymentCheckItem, DeploymentCheckResult } from '@template/contracts';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Client, type ConnectConfig } from 'ssh2';
import type { DeploymentSecrets } from './deployment-secrets.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class DeploymentCheckService {
  async checkGit(
    repositoryUrl: string,
    gitRef: string,
    secrets: DeploymentSecrets,
  ): Promise<DeploymentCheckResult> {
    const checks: DeploymentCheckItem[] = [];
    let temporaryDirectory = '';
    try {
      const auth = secrets.gitToken
        ? Buffer.from(`oauth2:${secrets.gitToken}`).toString('base64')
        : undefined;
      let sshCommand: string | undefined;
      if (secrets.gitSshPrivateKey) {
        temporaryDirectory = await mkdtemp(join(tmpdir(), 'aiforge-git-'));
        const keyPath = join(temporaryDirectory, 'deploy-key');
        await writeFile(keyPath, secrets.gitSshPrivateKey, { encoding: 'utf8', mode: 0o600 });
        await chmod(keyPath, 0o600);
        sshCommand = `ssh -i "${keyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
      }
      const { stdout } = await execFileAsync(
        'git',
        ['ls-remote', '--exit-code', repositoryUrl, gitRef],
        {
          timeout: 15_000,
          windowsHide: true,
          maxBuffer: 256_000,
          env: {
            ...process.env,
            ...(sshCommand ? { GIT_SSH_COMMAND: sshCommand } : {}),
            ...(auth
              ? {
                  GIT_CONFIG_COUNT: '1',
                  GIT_CONFIG_KEY_0: 'http.extraHeader',
                  GIT_CONFIG_VALUE_0: `Authorization: Basic ${auth}`,
                }
              : {}),
          },
        },
      );
      const sha = stdout.trim().split(/\s+/)[0] ?? '';
      checks.push({
        key: 'repository',
        label: 'Git 仓库访问',
        status: 'passed',
        message: `仓库和 ${gitRef} 可访问，提交 ${sha.slice(0, 12)}`,
      });
    } catch {
      checks.push({
        key: 'repository',
        label: 'Git 仓库访问',
        status: 'failed',
        message: '无法读取仓库或指定分支，请检查地址、分支和凭据权限',
      });
    } finally {
      if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    }
    return {
      success: checks.every((item) => item.status === 'passed'),
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  async checkServer(
    input: { host: string; port: number; user: string; authMode: string; deployPath: string },
    secrets: DeploymentSecrets,
  ): Promise<DeploymentCheckResult> {
    const { host, port } = input;
    const passed = await new Promise<boolean>((resolve) => {
      const socket = connect({ host, port });
      const finish = (value: boolean): void => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(8_000);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
    const checks: DeploymentCheckItem[] = [
      {
        key: 'tcp',
        label: '服务器端口',
        status: passed ? 'passed' : 'failed',
        message: passed ? `${host}:${port} 可以连接` : `${host}:${port} 无法连接`,
      },
    ];
    if (passed) {
      const client = new Client();
      try {
        await new Promise<void>((resolve, reject) => {
          const credential =
            input.authMode === 'password' ? secrets.sshPassword : secrets.sshPrivateKey;
          if (!credential) {
            reject(new Error('SSH credential is not configured'));
            return;
          }
          const config: ConnectConfig = {
            host,
            port,
            username: input.user,
            readyTimeout: 12_000,
            ...(input.authMode === 'password'
              ? { password: credential }
              : { privateKey: credential }),
          };
          client.once('ready', resolve).once('error', reject).connect(config);
        });
        checks.push({
          key: 'ssh',
          label: 'SSH 身份认证',
          status: 'passed',
          message: `已使用 ${input.user} 登录`,
        });
        const output = await this.remote(
          client,
          `command -v git && git --version; command -v docker && docker --version; docker compose version; df -Pk / | tail -1; mkdir -p '${input.deployPath.replaceAll("'", "'\\''")}' && test -w '${input.deployPath.replaceAll("'", "'\\''")}'`,
        );
        checks.push({
          key: 'runtime',
          label: '服务器运行环境',
          status: 'passed',
          message: output.trim().split(/\r?\n/).slice(0, 4).join(' · '),
        });
        checks.push({
          key: 'deploy_path',
          label: '部署目录',
          status: 'passed',
          message: `${input.deployPath} 可写`,
        });
      } catch {
        checks.push({
          key: 'ssh',
          label: 'SSH 与运行环境',
          status: 'failed',
          message: '身份认证失败，或服务器缺少 Git、Docker、Docker Compose、可写部署目录',
        });
      } finally {
        client.end();
      }
    }
    return {
      success: checks.every((item) => item.status === 'passed'),
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private remote(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) =>
      client.exec(command, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }
        let stdout = '',
          stderr = '';
        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        stream.once('close', (code: number | null) =>
          code === 0 ? resolve(stdout) : reject(new Error(stderr)),
        );
      }),
    );
  }
}
