import type { CreateUserRequest } from '@template/contracts';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto implements CreateUserRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
