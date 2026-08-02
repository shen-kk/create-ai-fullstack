import type { UpdateRoleRequest } from '@template/contracts';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleDto implements UpdateRoleRequest {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions!: string[];
}
