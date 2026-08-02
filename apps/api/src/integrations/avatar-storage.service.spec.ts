import type { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AvatarStorageService } from './avatar-storage.service.js';

describe('AvatarStorageService', () => {
  it('rejects uploads when object storage is not enabled', async () => {
    const integrations = {
      runtimeConfig: () => Promise.resolve({ enabled: false, values: {}, secrets: {} }),
    };
    const service = new AvatarStorageService(integrations as never);
    await expect(
      service.upload('admin-1', { buffer: Buffer.from('image'), mimetype: 'image/png', size: 5 }),
    ).rejects.toMatchObject({
      message: 'OBJECT_STORAGE_NOT_CONFIGURED',
    } satisfies Partial<ServiceUnavailableException>);
  });

  it('rejects unsupported files before accessing storage', async () => {
    const integrations = {
      runtimeConfig: () => Promise.resolve({ enabled: true, values: {}, secrets: {} }),
    };
    const service = new AvatarStorageService(integrations as never);
    await expect(
      service.upload('admin-1', { buffer: Buffer.from('text'), mimetype: 'text/plain', size: 4 }),
    ).rejects.toMatchObject({
      message: 'AVATAR_FILE_TYPE_INVALID',
    } satisfies Partial<BadRequestException>);
  });
});
