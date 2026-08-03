import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CustomerStatus } from '@template/contracts';

export class ListCustomersQueryDto {
  @IsOptional() @IsString() @MaxLength(80) keyword?: string;
  @IsOptional() @IsIn(['active', 'disabled']) status?: CustomerStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class ChangeCustomerStatusDto {
  @Transform(({ value }: { value: unknown }) => value)
  @IsIn(['active', 'disabled'])
  status!: CustomerStatus;
}
