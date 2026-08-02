import type { ChangeUserStatusRequest, UserStatus } from '@template/contracts';
import { IsIn } from 'class-validator';

const userStatuses = ['active', 'disabled', 'pending'] as const satisfies readonly UserStatus[];

export class ChangeUserStatusDto implements ChangeUserStatusRequest {
  @IsIn(userStatuses) status!: UserStatus;
}
