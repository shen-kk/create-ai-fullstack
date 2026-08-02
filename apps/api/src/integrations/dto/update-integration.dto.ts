import type { UpdateIntegrationConfigRequest } from '@template/contracts';
import { IsBoolean, IsObject } from 'class-validator';
export class UpdateIntegrationDto implements UpdateIntegrationConfigRequest {
  @IsBoolean() enabled!: boolean;
  @IsObject() values!: Record<string, string>;
  @IsObject() secrets!: Record<string, string>;
}
