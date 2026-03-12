export const RATE_LIMITS_BY_PLAN: Record<string, { requests_per_second: number }> = {
  free: { requests_per_second: 100 },
  pro: { requests_per_second: 500 },
  enterprise: { requests_per_second: 2000 },
};

export const AUTH_RATE_LIMIT = {
  requests: 10,
  window_seconds: 60,
} as const;

export const WS_CONNECTION_LIMITS_BY_PLAN: Record<string, number> = {
  free: 5,
  pro: 20,
  enterprise: 100,
};
