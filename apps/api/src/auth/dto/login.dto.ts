import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@template/contracts';

export class LoginDto implements LoginRequest {
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/) @MaxLength(16) phone!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
