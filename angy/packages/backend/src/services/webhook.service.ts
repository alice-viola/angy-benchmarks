import crypto from 'node:crypto';
import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';
import { ServiceError } from './vehicle.service.js';

interface ListParams {
  tenantId: string;
  is_active?: boolean;
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(webhookEndpoints.tenant_id, tenantId)];
  if (params.is_active !== undefined) {
    conditions.push(eq(webhookEndpoints.is_active, params.is_active));
  }
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db
      .select({
        id: webhookEndpoints.id,
        tenant_id: webhookEndpoints.tenant_id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        is_active: webhookEndpoints.is_active,
        failure_count: webhookEndpoints.failure_count,
        created_at: webhookEndpoints.created_at,
        updated_at: webhookEndpoints.updated_at,
      })
      .from(webhookEndpoints)
      .where(where)
      .orderBy(desc(webhookEndpoints.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(webhookEndpoints).where(where),
  ]);

  return {
    data: items,
    meta: { totalItems: total.count, page, pageSize: limit, totalPages: Math.ceil(total.count / limit) },
  };
}

export async function getById(tenantId: string, id: string) {
  const [webhook] = await db
    .select({
      id: webhookEndpoints.id,
      tenant_id: webhookEndpoints.tenant_id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      is_active: webhookEndpoints.is_active,
      failure_count: webhookEndpoints.failure_count,
      created_at: webhookEndpoints.created_at,
      updated_at: webhookEndpoints.updated_at,
    })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)))
    .limit(1);

  if (!webhook) throw new ServiceError('Webhook not found', 404, 'NOT_FOUND');
  return webhook;
}

export async function create(tenantId: string, data: any) {
  const secret = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(webhookEndpoints)
    .values({
      tenant_id: tenantId,
      url: data.url,
      events: data.events,
      secret,
    })
    .returning();

  return webhook; // Return with secret only on create
}

export async function update(tenantId: string, id: string, data: any) {
  await getById(tenantId, id);

  const updateData: any = {};
  if (data.url !== undefined) updateData.url = data.url;
  if (data.events !== undefined) updateData.events = data.events;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  if (Object.keys(updateData).length === 0) {
    return getById(tenantId, id);
  }

  await db
    .update(webhookEndpoints)
    .set(updateData)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)));

  return getById(tenantId, id);
}

export async function softDelete(tenantId: string, id: string) {
  await getById(tenantId, id);

  await db
    .update(webhookEndpoints)
    .set({ is_active: false })
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)));

  return { deleted: true };
}

export async function testWebhook(tenantId: string, id: string) {
  // Get webhook WITH secret for signing
  const [webhook] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)))
    .limit(1);

  if (!webhook) throw new ServiceError('Webhook not found', 404, 'NOT_FOUND');

  const testPayload = JSON.stringify({
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook delivery' },
  });

  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(testPayload)
    .digest('hex');

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: testPayload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      status_code: response.status,
      response_time_ms: Date.now() - startTime,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ServiceError('Webhook test timed out (10s)', 502, 'TIMEOUT');
    }
    throw new ServiceError(`Webhook test failed: ${err.message}`, 502, 'DELIVERY_FAILED');
  }
}
