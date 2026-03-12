import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints, notifications, users } from '../db/schema.js';
import { QUEUE_NAMES } from './queue-setup.js';

interface WebhookJobData {
  tenant_id: string;
  event: string;
  payload: Record<string, any>;
  endpoint_id: string;
}

const BACKOFF_DELAYS = [0, 60_000, 300_000, 1_800_000, 7_200_000];
const MAX_CONSECUTIVE_FAILURES = 5;

export async function processWebhookDelivery(job: Job<WebhookJobData>) {
  const { tenant_id, event, payload, endpoint_id } = job.data;

  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, endpoint_id),
        eq(webhookEndpoints.tenant_id, tenant_id),
        eq(webhookEndpoints.is_active, true),
      ),
    );

  if (!endpoint) {
    return { skipped: true, reason: 'Endpoint not found or inactive' };
  }

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NexusFleet-Signature': `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const newFailureCount = (endpoint.failure_count ?? 0) + 1;

    await db
      .update(webhookEndpoints)
      .set({ failure_count: newFailureCount, updated_at: new Date() })
      .where(eq(webhookEndpoints.id, endpoint.id));

    if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
      await deactivateEndpoint(endpoint.id, tenant_id);
    }

    throw new Error(`Webhook delivery failed: HTTP ${response.status}`);
  }

  // Reset failure count on success
  if (endpoint.failure_count && endpoint.failure_count > 0) {
    await db
      .update(webhookEndpoints)
      .set({ failure_count: 0, updated_at: new Date() })
      .where(eq(webhookEndpoints.id, endpoint.id));
  }

  return { delivered: true, status: response.status };
}

async function deactivateEndpoint(endpointId: string, tenantId: string) {
  await db
    .update(webhookEndpoints)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(webhookEndpoints.id, endpointId));

  // Notify tenant owner
  const ownerRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenant_id, tenantId),
        eq(users.role, 'owner'),
        eq(users.is_active, true),
      ),
    )
    .limit(1);

  if (ownerRows.length > 0) {
    await db.insert(notifications).values({
      tenant_id: tenantId,
      user_id: ownerRows[0].id,
      type: 'webhook_deactivated',
      title: 'Webhook endpoint deactivated',
      body: `A webhook endpoint was deactivated after ${MAX_CONSECUTIVE_FAILURES} consecutive delivery failures.`,
      data: { endpoint_id: endpointId },
    });
  }
}

export const WEBHOOK_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'custom' as const },
};

export async function dispatchWebhookEvent(
  tenantId: string,
  event: string,
  payload: Record<string, any>,
) {
  const { getQueue } = await import('./queue-setup.js');
  const queue = getQueue(QUEUE_NAMES.WEBHOOK_DELIVERY);

  const endpoints = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.tenant_id, tenantId),
        eq(webhookEndpoints.is_active, true),
        sql`${event} = ANY(${webhookEndpoints.events})`,
      ),
    );

  for (const ep of endpoints) {
    await queue.add(
      'deliver',
      { tenant_id: tenantId, event, payload, endpoint_id: ep.id },
      WEBHOOK_JOB_OPTIONS,
    );
  }
}

export function webhookBackoffStrategy(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, BACKOFF_DELAYS.length - 1);
  return BACKOFF_DELAYS[index];
}

export function createWebhookDeliveryWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(QUEUE_NAMES.WEBHOOK_DELIVERY, processWebhookDelivery, {
    connection: connection as any,
    concurrency: 5,
    settings: {
      backoffStrategy: webhookBackoffStrategy,
    },
  });
}
