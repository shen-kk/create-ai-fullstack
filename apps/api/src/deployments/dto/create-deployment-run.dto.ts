import { ArrayNotEmpty, IsArray, IsIn, IsString, Matches } from 'class-validator';
import type { CreateDeploymentRunRequest, DeployableApplication } from '@template/contracts';

const applications: DeployableApplication[] = ['admin', 'api', 'web'];

export class CreateDeploymentRunDto implements CreateDeploymentRunRequest {
  @IsString() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/) version!: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(applications, { each: true })
  applications!: DeployableApplication[];
}
