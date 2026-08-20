import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { UpsertMessageTemplateRequest } from '@template/contracts';

export class UpsertMessageTemplateDto implements UpsertMessageTemplateRequest {
  @IsString() @Matches(/^[a-z][a-z0-9_]*$/) @MaxLength(80) code!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsIn(['email', 'sms']) channel!: 'email' | 'sms';
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(160) subject!:
    string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(4000) textBody!:
    string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(12000) htmlBody!:
    string | null;
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  providerTemplateId!: string | null;
  @IsObject() parameterMapping!: Record<string, string>;
  @IsBoolean() enabled!: boolean;
}
