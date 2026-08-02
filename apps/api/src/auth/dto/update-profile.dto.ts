import type { UpdateProfileRequest } from '@template/contracts';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
