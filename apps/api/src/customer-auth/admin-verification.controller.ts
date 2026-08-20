import { BadRequestException, Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import type { SendVerificationCodeResponse, VerificationPurpose } from '@template/contracts';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { VerificationService } from './verification.service.js';

class TestDeliveryDto {
  @IsString() @MaxLength(120) target!: string;
  @IsIn(['login', 'reset_password', 'bind_contact']) purpose!: VerificationPurpose;
}

@Controller('integrations')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('integrations.manage')
export class AdminVerificationController {
  constructor(private readonly verification: VerificationService) {}
  @Post(':channel/test-delivery')
  test(
    @Param('channel') channel: string,
    @Body() input: TestDeliveryDto,
  ): Promise<SendVerificationCodeResponse> {
    if (channel !== 'sms' && channel !== 'email')
      throw new BadRequestException('UNSUPPORTED_TEST_CHANNEL');
    return this.verification.send(channel, input.target, input.purpose);
  }
}
