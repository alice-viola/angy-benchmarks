import { eq, and, count, desc, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { notifications } from '../db/schema.js';
import { ServiceError } from './vehicle.service.js';

interface ListParams {
  tenantId: string;
  userId: string;
  is_read?: boolean;
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, userId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(notifications.tenant_id, tenantId),
    eq(notifications.user_id, userId),
  ];

  if (params.is_read === true) {
    conditions.push(isNotNull(notifications.read_at));
  } else if (params.is_read === false) {
    conditions.push(isNull(notifications.read_at));
  }

  const where = and(...conditions);

  const [items, [total], [unread]] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.created_at)).limit(limit).offset(offset),
    db.select({ count: count() }).from(notifications).where(where),
    db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenant_id, tenantId),
          eq(notifications.user_id, userId),
          isNull(notifications.read_at),
        ),
      ),
  ]);

  return {
    data: items,
    meta: {
      total: total.count,
      page,
      limit,
      totalPages: Math.ceil(total.count / limit),
      unreadCount: unread.count,
    },
  };
}

export async function markAsRead(tenantId: string, userId: string, id: string) {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.tenant_id, tenantId),
        eq(notifications.user_id, userId),
      ),
    )
    .limit(1);

  if (!notification) throw new ServiceError('Notification not found', 404, 'NOT_FOUND');

  if (notification.read_at) return notification; // idempotent

  const [updated] = await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(eq(notifications.id, id))
    .returning();

  return updated;
}

export async function markAllAsRead(tenantId: string, userId: string) {
  await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(
      and(
        eq(notifications.tenant_id, tenantId),
        eq(notifications.user_id, userId),
        isNull(notifications.read_at),
      ),
    );

  return { success: true };
}
