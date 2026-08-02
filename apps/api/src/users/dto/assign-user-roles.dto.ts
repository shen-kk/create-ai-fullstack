import type { AssignUserRolesRequest } from '@template/contracts';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class AssignUserRolesDto implements AssignUserRolesRequest {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) roleCodes!: string[];
}
