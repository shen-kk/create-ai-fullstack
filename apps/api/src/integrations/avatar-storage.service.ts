import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import COS from 'cos-nodejs-sdk-v5';
import { randomUUID } from 'node:crypto';
import type { ServiceFeatureCode } from '@template/contracts';
import { IntegrationsService } from './integrations.service.js';
export interface AvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}
@Injectable()
export class AvatarStorageService {
  constructor(private readonly integrations: IntegrationsService) {}
  async upload(
    userId: string,
    file: AvatarFile | undefined,
    featureCode: Extract<
      ServiceFeatureCode,
      'admin.avatar_upload' | 'customer.avatar_upload'
    > = 'admin.avatar_upload',
  ): Promise<string> {
    if (!file) throw new BadRequestException('AVATAR_FILE_REQUIRED');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new BadRequestException('AVATAR_FILE_TYPE_INVALID');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('AVATAR_FILE_TOO_LARGE');
    const config = await this.integrations.runtimeConfig('object_storage', featureCode);
    if (!config.enabled) throw new ServiceUnavailableException('OBJECT_STORAGE_NOT_CONFIGURED');
    if (config.values.provider !== 'tencent_cos')
      throw new ServiceUnavailableException('OBJECT_STORAGE_ADAPTER_UNAVAILABLE');
    const secretId = config.values.accessKeyId,
      secretKey = config.secrets.secretAccessKey,
      bucket = config.values.bucket,
      region = config.values.region;
    if (!secretId || !secretKey || !bucket || !region)
      throw new ServiceUnavailableException('OBJECT_STORAGE_CONFIG_INCOMPLETE');
    const extension =
        file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg',
      key = `avatars/${userId}/${randomUUID()}.${extension}`;
    const result = await new COS({ SecretId: secretId, SecretKey: secretKey }).putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    if (!result.Location) throw new ServiceUnavailableException('OBJECT_STORAGE_UPLOAD_FAILED');
    return `https://${result.Location}`;
  }
}
