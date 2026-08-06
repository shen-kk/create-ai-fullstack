import { Injectable } from '@nestjs/common';
import type {
  DeploymentConnectionCheck,
  DeploymentConnectionTestResult,
} from '@template/contracts';
import { Client, type ConnectConfig } from 'ssh2';
import type { DeploymentSecrets } from './deployment-secrets.js';

interface ConnectionTarget {
  host: string;
  sshPort: number;
  sshUser: string;
  deployPath: string;
}

const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

@Injectable()
export class DeploymentConnectionService {
  async test(
    target: ConnectionTarget,
    secrets: DeploymentSecrets,
  ): Promise<DeploymentConnectionTestResult> {
    const checkedAt = new Date().toISOString();
    try {
      const client = await this.connect(target, secrets);
      try {
        const output = await this.exec(
          client,
          `docker version --format '{{.Server.Version}}' && mkdir -p ${quote(target.deployPath)} && df -Pk ${quote(target.deployPath)} | tail -1 && test -w ${quote(target.deployPath)}`,
        );
        const lines = output.trim().split(/\r?\n/);
        return {
          success: true,
          checkedAt,
          checks: [
            this.check('tcp', '服务器端口', true, `${target.host}:${target.sshPort} 可以连接`),
            this.check('ssh', 'SSH 身份认证', true, `已使用 ${target.sshUser} 登录`),
            this.check('docker', 'Docker 运行环境', true, `Docker ${lines[0] ?? '可用'}`),
            this.check('disk', '服务器磁盘', true, lines[1] ?? '磁盘信息读取成功'),
            this.check('deploy_path', '部署目录', true, `${target.deployPath} 可写入`),
          ],
        };
      } finally {
        client.end();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接检查失败';
      return {
        success: false,
        checkedAt,
        checks: [this.check('ssh', '服务器连接与运行环境', false, message)],
      };
    }
  }

  private connect(target: ConnectionTarget, secrets: DeploymentSecrets): Promise<Client> {
    const config: ConnectConfig = {
      host: target.host,
      port: target.sshPort,
      username: target.sshUser,
      readyTimeout: 10_000,
      ...(secrets.sshPrivateKey ? { privateKey: secrets.sshPrivateKey } : {}),
      ...(secrets.sshPassword ? { password: secrets.sshPassword } : {}),
    };
    if (!config.privateKey && !config.password)
      return Promise.reject(new Error('请先配置 SSH 私钥或密码'));
    return new Promise((resolve, reject) => {
      const client = new Client();
      client.once('ready', () => resolve(client));
      client.once('error', (error) => reject(new Error(`SSH 连接失败：${error.message}`)));
      client.connect(config);
    });
  }

  private exec(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (error, stream) => {
        if (error) return reject(error);
        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer) => (stdout += data.toString('utf8')));
        stream.stderr.on('data', (data: Buffer) => (stderr += data.toString('utf8')));
        stream.once('close', (code: number) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(stderr.trim() || `远程检查退出码 ${code}`));
        });
      });
    });
  }

  private check(
    key: DeploymentConnectionCheck['key'],
    label: string,
    passed: boolean,
    message: string,
  ): DeploymentConnectionCheck {
    return { key, label, status: passed ? 'passed' : 'failed', message };
  }
}
