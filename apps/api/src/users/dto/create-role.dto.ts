import type { CreateRoleRequest } from '@template/contracts';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto implements CreateRoleRequest {
  @IsString() @Matches(/^[a-z][a-z0-9_]{2,49}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions!: string[];
}
