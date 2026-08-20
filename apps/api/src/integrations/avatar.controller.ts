import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@template/contracts';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { AvatarStorageService, type AvatarFile } from './avatar-storage.service.js';

@ApiTags('auth')
@Controller('auth')
export class AvatarController {
  constructor(
    private readonly auth: AuthService,
    private readonly avatars: AvatarStorageService,
  ) {}

  @Post('avatar')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: AvatarFile | undefined,
    @Req() request: Request & { user: AuthUser },
  ): Promise<AuthUser> {
    const avatarUrl = await this.avatars.upload(request.user.id, file, 'admin.avatar_upload');
    return this.auth.updateProfile(request.user.id, request.user.name, avatarUrl);
  }
}
