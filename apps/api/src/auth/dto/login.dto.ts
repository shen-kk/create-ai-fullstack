import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH, type LoginRequest } from '@template/contracts';

export class LoginDto implements LoginRequest {
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/) @MaxLength(16) phone!: string;
  @IsString() @MinLength(PASSWORD_MIN_LENGTH) @MaxLength(128) password!: string;
}
