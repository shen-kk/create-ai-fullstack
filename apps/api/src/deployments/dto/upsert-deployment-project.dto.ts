import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type {
  DeploymentUnitDefinition,
  DeploymentVariableDefinition,
  UpsertDeploymentProjectRequest,
} from '@template/contracts';

class DeploymentUnitDefinitionDto implements DeploymentUnitDefinition {
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/) key!: string;
  @IsString() @MaxLength(80) name!: string;
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/) service!: string;
  @IsOptional() @IsString() @MaxLength(500) migrationCommand!: string | null;
  @IsOptional() @IsString() @MaxLength(500) healthCheckUrl!: string | null;
}

class DeploymentVariableDefinitionDto implements DeploymentVariableDefinition {
  @Matches(/^[A-Z][A-Z0-9_]{0,127}$/) key!: string;
  @IsString() @MaxLength(80) label!: string;
  @IsBoolean() required!: boolean;
  @IsBoolean() secret!: boolean;
  @IsOptional()
  @IsIn(['sql', 'redis', 'object_storage', 'custom'])
  resourceKind!: DeploymentVariableDefinition['resourceKind'];
}

export class UpsertDeploymentProjectDto implements UpsertDeploymentProjectRequest {
  @IsString() @MaxLength(80) name!: string;
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/) code!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsIn(['docker-compose']) type!: UpsertDeploymentProjectRequest['type'];
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,199}$/) composeFile!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeploymentUnitDefinitionDto)
  units!: DeploymentUnitDefinitionDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeploymentVariableDefinitionDto)
  variables!: DeploymentVariableDefinitionDto[];
}
