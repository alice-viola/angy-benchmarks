import { FastifyInstance } from 'fastify';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { notifications } from '../db/schema.js';

export async function notificationRoutes(app: FastifyInstance) {
  // GET /api/v1/notifications
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const tenant_id = request.user.tenant_id;
    const user_id = request.user.id;
    const page = query.page ? Number(query.page) : 1;
    const page_size = query.page_size ? Math.min(Number(query.page_size), 100) : 25;
    const offset = (page - 1) * page_size;

    const baseWhere = and(
      eq(notifications.tenant_id, tenant_id),
      eq(notifications.user_id, user_id),
    )!;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(baseWhere);

    const [{ unread_count }] = await db
      .select({ unread_count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(baseWhere, isNull(notifications.read_at)));

    const total_items = count;
    const total_pages = Math.ceil(total_items / page_size);

    const rows = await db
      .select()
      .from(notifications)
      .where(baseWhere)
      .orderBy(desc(notifications.created_at))
      .limit(page_size)
      .offset(offset);

    const data = rows.map((n) => ({
      id: n.id,
      type: n.type ?? '',
      title: n.title ?? '',
      body: n.body ?? '',
      data: n.data ?? {},
      read_at: n.read_at?.toISOString() ?? null,
      created_at: n.created_at?.toISOString() ?? '',
    }));

    return {
      success: true,
      data,
      meta: { page, page_size, total_items, total_pages, unread_count },
    };
  });

  // POST /api/v1/notifications/read-all
  app.post('/read-all', async (request) => {
    const result = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(
        and(
          eq(notifications.tenant_id, request.user.tenant_id),
          eq(notifications.user_id, request.user.id),
          isNull(notifications.read_at),
        ),
      )
      .returning({ id: notifications.id });

    return { success: true, data: { updated_count: result.length } };
  });

  // PUT /api/v1/notifications/:id/read
  app.put<{ Params: { id: string } }>('/:id/read', async (request, reply) => {
    const [updated] = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(
        and(
          eq(notifications.id, request.params.id),
          eq(notifications.tenant_id, request.user.tenant_id),
          eq(notifications.user_id, request.user.id),
        ),
      )
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found', details: null },
      });
    }

    return { success: true, data: null };
  });
}
