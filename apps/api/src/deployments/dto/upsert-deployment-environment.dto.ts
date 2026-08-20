import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { UpsertDeploymentEnvironmentRequest } from '@template/contracts';

export class UpsertDeploymentEnvironmentDto implements UpsertDeploymentEnvironmentRequest {
  @IsString() name!: string;
  @IsIn(['development', 'test', 'staging', 'production', 'custom'])
  kind!: UpsertDeploymentEnvironmentRequest['kind'];
  @IsString() projectId!: string;
  @IsOptional()
  @IsArray()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/, { each: true })
  applications!: NonNullable<UpsertDeploymentEnvironmentRequest['applications']>;
  @IsIn(['github', 'gitlab', 'cnb', 'gitee', 'generic'])
  gitProvider!: UpsertDeploymentEnvironmentRequest['gitProvider'];
  @IsString() repositoryUrl!: string;
  @IsString() gitRef!: string;
  @IsIn(['none', 'token', 'ssh_key'])
  gitAuthMode!: UpsertDeploymentEnvironmentRequest['gitAuthMode'];
  @IsString() host!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) sshPort!: number;
  @IsString() sshUser!: string;
  @IsIn(['password', 'private_key'])
  sshAuthMode!: UpsertDeploymentEnvironmentRequest['sshAuthMode'];
  @IsString() deployPath!: string;
  @IsOptional() @IsString() adminUrl?: string;
  @IsOptional() @IsString() apiUrl?: string;
  @IsOptional() @IsString() webUrl?: string;
  @IsOptional() @IsString() healthCheckUrl?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) retainReleases!: number;
  @IsString() serverResourceId!: string;
  @IsString() gitResourceId!: string;
  @IsOptional() @IsString() sqlResourceId?: string;
  @IsOptional() @IsString() redisResourceId?: string;
  @IsOptional() @IsObject() values?: Record<string, string>;
  @IsObject() secrets!: UpsertDeploymentEnvironmentRequest['secrets'];
}
