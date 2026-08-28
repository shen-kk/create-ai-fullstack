import type { UpdateProfileRequest } from '@template/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
}
