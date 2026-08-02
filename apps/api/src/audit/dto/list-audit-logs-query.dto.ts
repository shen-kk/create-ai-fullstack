import type { AuditLogListQuery } from '@template/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAuditLogsQueryDto implements AuditLogListQuery {
  @IsOptional() @IsString() @MaxLength(128) keyword?: string;
  @IsOptional() @IsString() @MaxLength(80) action?: string;
  @IsOptional() @IsString() @MaxLength(80) resource?: string;
  @IsOptional() @IsIn(['success', 'failure']) result?: 'success' | 'failure';
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
