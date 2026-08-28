import { PASSWORD_MIN_LENGTH, type ChangePasswordRequest } from '@template/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';
export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString() @MinLength(PASSWORD_MIN_LENGTH) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(PASSWORD_MIN_LENGTH) @MaxLength(128) newPassword!: string;
}
