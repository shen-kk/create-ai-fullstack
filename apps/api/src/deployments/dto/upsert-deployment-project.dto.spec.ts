import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpsertDeploymentProjectDto } from './upsert-deployment-project.dto.js';

const validProject = {
  name: '商城服务',
  code: 'mall-platform',
  type: 'docker-compose',
  composeFile: 'deploy/compose.yml',
  units: [
    {
      key: 'order-service',
      name: '订单服务',
      service: 'orders',
      migrationCommand: null,
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

  it('拒绝可能注入命令的单元代码和 Compose 路径', async () => {
    const dto = plainToInstance(UpsertDeploymentProjectDto, {
      ...validProject,
      composeFile: '../compose.yml',
      units: [{ ...validProject.units[0], key: 'orders;rm' }],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
