import { PASSWORD_MIN_LENGTH } from '@template/contracts';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

const acceptedPassword = 'A'.repeat(PASSWORD_MIN_LENGTH);
const shortPassword = 'A'.repeat(PASSWORD_MIN_LENGTH - 1);

describe('shared password policy', () => {
  it('accepts six-character passwords at every account boundary', async () => {
    const inputs = [
      Object.assign(new LoginDto(), { phone: '13800000000', password: acceptedPassword }),
      Object.assign(new ChangePasswordDto(), {
        currentPassword: acceptedPassword,
        newPassword: acceptedPassword,
      }),
      Object.assign(new CreateUserDto(), {
        name: '测试管理员',
        phone: '13800000000',
        password: acceptedPassword,
      }),
    ];

    for (const input of inputs) expect(await validate(input)).toHaveLength(0);
  });

  it('rejects passwords shorter than the shared minimum', async () => {
    const admin = Object.assign(new LoginDto(), {
      phone: '13800000000',
      password: shortPassword,
    });
    expect(await validate(admin)).not.toHaveLength(0);
  });
});
