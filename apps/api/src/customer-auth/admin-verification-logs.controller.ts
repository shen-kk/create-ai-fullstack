import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { VerificationDeliveryListResponse } from '@template/contracts';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { VerificationQueryDto } from './dto/verification-query.dto.js';
import { VerificationService } from './verification.service.js';
@Controller('verification-deliveries')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('verification.read')
export class AdminVerificationLogsController {
  constructor(private readonly verification: VerificationService) {}
  @Get() list(@Query() query: VerificationQueryDto): Promise<VerificationDeliveryListResponse> {
    return this.verification.list(query);
  }
}
