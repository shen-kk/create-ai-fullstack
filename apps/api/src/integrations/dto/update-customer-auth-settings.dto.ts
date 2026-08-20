import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { CustomerAuthMode, UpdateCustomerAuthSettingsRequest } from '@template/contracts';

export class UpdateCustomerAuthSettingsDto implements UpdateCustomerAuthSettingsRequest {
  @IsIn(['phone', 'email'])
  mode!: CustomerAuthMode;

  @IsInt()
  @Min(60)
  @Max(1800)
  verificationTtlSeconds!: number;

  @IsInt()
  @Min(30)
  @Max(300)
  verificationRetrySeconds!: number;
}
