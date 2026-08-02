import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@template/contracts';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { RoleOption, UserListResponse, UserSummary } from '@template/contracts';

import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UsersService } from './users.service.js';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ChangeUserStatusDto } from './dto/change-user-status.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('users.read')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated users matching the query' })
  list(@Query() query: ListUsersQueryDto): Promise<UserListResponse> {
    return this.usersService.list(query);
  }

  @Post()
  @RequirePermissions('users.write')
  create(
    @Body() input: CreateUserDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<UserSummary> {
    return this.usersService.create(input, this.auditContext(request));
  }

  @Patch(':id')
  @RequirePermissions('users.write')
  update(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<UserSummary> {
    return this.usersService.update(id, input, this.auditContext(request));
  }

  @Patch(':id/status')
  @RequirePermissions('users.write')
  changeStatus(
    @Param('id') id: string,
    @Body() input: ChangeUserStatusDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<UserSummary> {
    return this.usersService.changeStatus(id, input, this.auditContext(request));
  }

  @Get('roles/options')
  @RequirePermissions('roles.manage')
  listRoles(): Promise<RoleOption[]> {
    return this.usersService.listRoles();
  }

  @Patch(':id/roles')
  @RequirePermissions('users.write', 'roles.manage')
  assignRoles(
    @Param('id') id: string,
    @Body() input: AssignUserRolesDto,
    @Req() request: Request & { user: AuthUser; requestId?: string },
  ): Promise<UserSummary> {
    return this.usersService.assignRoles(id, input, this.auditContext(request));
  }

  private auditContext(request: Request & { user: AuthUser; requestId?: string }): {
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
