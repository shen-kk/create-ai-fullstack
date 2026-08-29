import type { UpdateUserRequest } from '@template/contracts';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto implements UpdateUserRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/) phone!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
