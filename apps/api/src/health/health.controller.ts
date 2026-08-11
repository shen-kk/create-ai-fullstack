import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse, SystemInfoResponse } from '@template/contracts';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { PrismaService } from '../database/prisma.service.js';

@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'Compatibility liveness endpoint' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOkResponse({ description: 'Process is alive' })
  live(): HealthResponse {
    return this.getHealth();
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Required dependencies are ready' })
  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('DATABASE_UNAVAILABLE');
    }
  }

  @Get('info')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions('system.read')
  @ApiOkResponse({ description: 'Non-sensitive runtime information' })
  info(): SystemInfoResponse {
    const rawEnvironment = process.env.NODE_ENV;
    const environment =
      rawEnvironment === 'production' || rawEnvironment === 'test' ? rawEnvironment : 'development';
    return {
      service: 'api',
      version: process.env.npm_package_version ?? '0.0.0',
      environment,
      dataSource: 'prisma',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}
