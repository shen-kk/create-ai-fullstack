import { SetMetadata } from '@nestjs/common';

export const requiredPermissionsKey = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(requiredPermissionsKey, permissions);
