import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpsertDeploymentProjectDto } from './upsert-deployment-project.dto.js';

const validProject = {
  name: '商城服务',
  code: 'mall-platform',
  type: 'release-directory',
  installCommand: 'corepack pnpm install --frozen-lockfile',
  units: [
    {
      key: 'order-service',
      name: '订单服务',
      buildCommand: 'corepack pnpm --filter @mall/orders build',
      migrationCommand: null,
      restartCommand: 'pm2 startOrReload ecosystem.config.cjs --only mall-orders --update-env',
      healthCheckUrl: null,
    },
  ],
  variables: [
    {
      key: 'DATABASE_URL',
      label: '数据库连接',
      required: true,
      secret: true,
      resourceKind: 'sql',
    },
  ],
};

describe('UpsertDeploymentProjectDto', () => {
  it('接受任意符合命名规则的部署单元，不限制为三端', async () => {
    const dto = plainToInstance(UpsertDeploymentProjectDto, validProject);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('拒绝可能注入命令的单元代码和多行命令', async () => {
    const dto = plainToInstance(UpsertDeploymentProjectDto, {
      ...validProject,
      installCommand: 'pnpm install\nrm -rf /tmp/example',
      units: [{ ...validProject.units[0], key: 'orders;rm' }],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
