export const ROLES = ['owner', 'admin', 'dispatcher', 'viewer'] as const;

export type Role = (typeof ROLES)[number];
