import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser, CustomerListResponse, CustomerSummary } from '@template/contracts';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CustomerRepository } from './customer.repository.js';
import { CustomerSessionRepository } from './customer-session.repository.js';
import { ChangeCustomerStatusDto, ListCustomersQueryDto } from './dto/admin-customer.dto.js';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('customers.read')
export class AdminCustomersController {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly sessions: CustomerSessionRepository,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: ListCustomersQueryDto): Promise<CustomerListResponse> {
    return this.customers.list(query);
  }

  @Patch(':id/status')
  @RequirePermissions('customers.write')
  async changeStatus(
    @Param('id') id: string,
    @Body() input: ChangeCustomerStatusDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<CustomerSummary> {
    const customer = await this.customers.changeStatus(id, input.status);
    if (!customer) throw new NotFoundException('CUSTOMER_NOT_FOUND');
    if (input.status === 'disabled') await this.sessions.revokeAll(id);
    await this.audit.record({
      actorId: request.user.id,
      action: 'customer.status.change',
      resource: 'customer',
      resourceId: id,
      result: 'success',
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
      metadata: { status: input.status },
    });
    return customer;
  }
}
