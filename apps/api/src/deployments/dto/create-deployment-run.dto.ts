import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import type { CreateDeploymentRunRequest } from '@template/contracts';

export class CreateDeploymentRunDto implements CreateDeploymentRunRequest {
  @IsArray()
  @IsIn(['admin', 'api', 'web'], { each: true })
  applications!: CreateDeploymentRunRequest['applications'];
  @IsOptional() @IsString() gitRef?: string;
}
