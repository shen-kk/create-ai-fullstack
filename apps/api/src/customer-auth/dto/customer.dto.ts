import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CustomerRegisterDto {
  @Matches(/^1\d{10}$/) phone!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @Matches(/^\d{6}$/) verificationCode!: string;
}
export class SendVerificationCodeDto {
  @IsIn(['sms', 'email']) channel!: 'sms' | 'email';
  @IsString() @MaxLength(120) target!: string;
  @IsIn(['register', 'login', 'reset_password', 'bind_contact']) purpose!:
    'register' | 'login' | 'reset_password' | 'bind_contact';
}
export class VerificationCodeLoginDto {
  @Matches(/^1\d{10}$/) phone!: string;
  @Matches(/^\d{6}$/) code!: string;
}
export class ResetCustomerPasswordDto {
  @Matches(/^1\d{10}$/) phone!: string;
  @Matches(/^\d{6}$/) code!: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword!: string;
}
export class BindCustomerContactDto {
  @IsIn(['sms', 'email']) channel!: 'sms' | 'email';
  @IsString() @MaxLength(120) target!: string;
  @Matches(/^\d{6}$/) code!: string;
}
export class CustomerLoginDto {
  @Matches(/^1\d{10}$/) phone!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
export class UpdateCustomerProfileDto {
  @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string | null;
  @IsOptional() @IsString() @MaxLength(2048) avatarUrl?: string | null;
}
export class ChangeCustomerPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword!: string;
}
