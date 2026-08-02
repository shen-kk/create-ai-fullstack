import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuditLogListResponse } from '@template/contracts';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() list(@Query() query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    return this.audit.list(query);
  }
}
