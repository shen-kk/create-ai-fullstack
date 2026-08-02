import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser, PermissionOption, RoleOption } from '@template/contracts';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UsersService } from './users.service.js';

type AuthenticatedRequest = Request & { user: AuthUser; requestId?: string };
@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('roles.manage')
export class RolesController {
  constructor(private readonly users: UsersService) {}
  @Get() list(): Promise<RoleOption[]> {
    return this.users.listRoles();
  }
  @Get('permissions') permissions(): Promise<PermissionOption[]> {
    return this.users.listPermissions();
  }
  @Post() create(
    @Body() input: CreateRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoleOption> {
    return this.users.createRole(input, this.context(request));
  }
  @Patch(':code') update(
    @Param('code') code: string,
    @Body() input: UpdateRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoleOption> {
    return this.users.updateRole(code, input, this.context(request));
  }
  private context(request: AuthenticatedRequest): {
    actorId: string;
    requestId?: string;
    ipAddress?: string;
  } {
    return {
      actorId: request.user.id,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    };
  }
}
