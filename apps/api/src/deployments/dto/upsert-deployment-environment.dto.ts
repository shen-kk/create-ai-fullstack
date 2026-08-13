import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import type { UpsertDeploymentEnvironmentRequest } from '@template/contracts';

export class UpsertDeploymentEnvironmentDto implements UpsertDeploymentEnvironmentRequest {
  @IsString() name!: string;
  @IsIn(['development', 'test', 'staging', 'production', 'custom'])
  kind!: UpsertDeploymentEnvironmentRequest['kind'];
  @IsArray()
  @IsIn(['admin', 'api', 'web'], { each: true })
  applications!: UpsertDeploymentEnvironmentRequest['applications'];
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
  @IsObject() secrets!: UpsertDeploymentEnvironmentRequest['secrets'];
}
