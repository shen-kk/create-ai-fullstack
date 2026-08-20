import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DeploymentWorkerModule } from './deployments/deployment-worker.module.js';

function loadTemplateDevelopmentEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env.template-dev'),
    resolve(process.cwd(), '../../.env.template-dev'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([^#=\s]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1],
      rawValue = match[2];
    if (!key || rawValue === undefined) continue;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function bootstrap(): Promise<void> {
  loadTemplateDevelopmentEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.CONFIG_ENCRYPTION_KEY || process.env.CONFIG_ENCRYPTION_KEY.length < 32)
  )
    throw new Error('CONFIG_ENCRYPTION_KEY must contain at least 32 characters');
  process.env.DEPLOY_WORKER_ENABLED = 'true';
  const context = await NestFactory.createApplicationContext(DeploymentWorkerModule, {
    logger: ['log', 'error', 'warn'],
  });
  const logger = new Logger('DeployWorker');
  logger.log('Deploy Worker 已启动，正在等待部署任务');
  const shutdown = async (): Promise<void> => {
    await context.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void bootstrap();
