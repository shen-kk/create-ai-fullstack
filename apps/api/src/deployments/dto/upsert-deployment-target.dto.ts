import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  DeployableApplication,
  DeploymentAccessMode,
  DeploymentEnvironmentKind,
  UpsertDeploymentTargetRequest,
} from '@template/contracts';

const applications: DeployableApplication[] = ['admin', 'api', 'web'];
const environments: DeploymentEnvironmentKind[] = [
  'development',
  'test',
  'staging',
  'production',
  'custom',
];
const accessModes: DeploymentAccessMode[] = ['automatic_https', 'existing_proxy', 'ip_port'];
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class UpsertDeploymentTargetDto implements UpsertDeploymentTargetRequest {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsIn(environments) environment!: DeploymentEnvironmentKind;
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(applications, { each: true })
  applications!: DeployableApplication[];
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/)
  host!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) sshPort!: number;
  @IsString() @Matches(/^[a-z_][a-z0-9_-]{0,31}$/i) sshUser!: string;
  @IsString() @Matches(/^\/[a-zA-Z0-9._/-]+$/) deployPath!: string;
  @IsIn(accessModes) accessMode!: DeploymentAccessMode;
  @Transform(emptyToUndefined) @IsOptional() @IsUrl({ require_tld: false }) adminUrl?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsUrl({ require_tld: false }) apiUrl?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsUrl({ require_tld: false }) webUrl?: string;
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^(?:https?:\/\/cnb\.cool\/)?[a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+$/)
  cnbRepository?: string;
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^api_trigger_[a-zA-Z0-9_-]+$/)
  cnbEvent?: string;
  @IsObject() secrets!: UpsertDeploymentTargetRequest['secrets'];
}
