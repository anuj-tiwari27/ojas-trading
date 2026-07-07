import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Require one or more permissions to access a route.
 * Permissions are keyed as "<resource>:<action>", e.g. @RequirePermissions('trade:create').
 * A user passes if they hold ALL listed permissions (or are super admin).
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
