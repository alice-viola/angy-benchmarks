export const ROLES = ['owner', 'admin', 'dispatcher', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'tenants:manage',
  'users:read',
  'users:write',
  'shipments:read',
  'shipments:write',
  'vehicles:read',
  'vehicles:write',
  'drivers:read',
  'drivers:write',
  'routes:read',
  'routes:write',
  'geofences:read',
  'geofences:write',
  'webhooks:read',
  'webhooks:write',
  'analytics:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    'users:read',
    'users:write',
    'shipments:read',
    'shipments:write',
    'vehicles:read',
    'vehicles:write',
    'drivers:read',
    'drivers:write',
    'routes:read',
    'routes:write',
    'geofences:read',
    'geofences:write',
    'webhooks:read',
    'webhooks:write',
    'analytics:read',
  ],
  dispatcher: [
    'shipments:read',
    'shipments:write',
    'vehicles:read',
    'drivers:read',
    'routes:read',
    'routes:write',
    'geofences:read',
    'analytics:read',
  ],
  viewer: [
    'shipments:read',
    'vehicles:read',
    'drivers:read',
    'routes:read',
    'geofences:read',
    'analytics:read',
  ],
};
