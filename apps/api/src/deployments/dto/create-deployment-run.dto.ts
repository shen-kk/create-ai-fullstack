import { IsArray, IsOptional, IsString, Matches } from 'class-validator';
import type { CreateDeploymentRunRequest } from '@template/contracts';

export class CreateDeploymentRunDto implements CreateDeploymentRunRequest {
  @IsOptional()
  @IsArray()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/, { each: true })
  applications!: NonNullable<CreateDeploymentRunRequest['applications']>;
  @IsOptional() @IsString() gitRef?: string;
}
