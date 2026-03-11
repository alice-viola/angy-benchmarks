const connectionCounts = new Map<string, number>();

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 20,
  enterprise: 100,
};

export function canConnect(tenantId: string, plan: string): boolean {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const current = connectionCounts.get(tenantId) ?? 0;
  return current < limit;
}

export function trackConnection(tenantId: string): () => void {
  const current = connectionCounts.get(tenantId) ?? 0;
  connectionCounts.set(tenantId, current + 1);

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    const count = connectionCounts.get(tenantId) ?? 1;
    if (count <= 1) {
      connectionCounts.delete(tenantId);
    } else {
      connectionCounts.set(tenantId, count - 1);
    }
  };
}
