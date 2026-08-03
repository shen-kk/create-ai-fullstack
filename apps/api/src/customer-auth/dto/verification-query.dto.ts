import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class VerificationQueryDto {
  @IsOptional() @IsIn(['sms', 'email']) channel?: 'sms' | 'email';
  @IsOptional() @IsIn(['register', 'login', 'reset_password', 'bind_contact']) purpose?:
    'register' | 'login' | 'reset_password' | 'bind_contact';
  @IsOptional() @IsIn(['sent', 'failed', 'consumed', 'expired']) status?:
    'sent' | 'failed' | 'consumed' | 'expired';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
