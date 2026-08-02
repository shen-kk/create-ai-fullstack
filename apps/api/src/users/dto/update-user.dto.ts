import type { UpdateUserRequest } from '@template/contracts';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto implements UpdateUserRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}
