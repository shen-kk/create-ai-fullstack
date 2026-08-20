import { IsOptional, IsString, ValidateIf } from 'class-validator';
import type { UpdateServiceFeatureBindingRequest } from '@template/contracts';

export class UpdateServiceFeatureBindingDto implements UpdateServiceFeatureBindingRequest {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  resourceId!: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  templateId?: string | null;
}
