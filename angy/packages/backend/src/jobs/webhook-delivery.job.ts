import crypto from 'node:crypto';
import type { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints, notifications, users } from '../db/schema.js';

interface WebhookJobInput {
  webhook_endpoint_id?: string;
  event: string;
  tenant_id?: string;
  payload: Record<string, unknown>;
}

export async function processWebhookDelivery(job: Job<WebhookJobInput>): Promise<void> {
  const { event, payload } = job.data;

  // If a specific endpoint is given, deliver to it
  // Otherwise, find all active endpoints for this tenant that subscribe to this event
  let endpoints: { id: string; url: string; secret: string; tenant_id: string }[];

  if (job.data.webhook_endpoint_id) {
    const [ep] = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        tenant_id: webhookEndpoints.tenant_id,
      })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, job.data.webhook_endpoint_id),
          eq(webhookEndpoints.is_active, true),
        ),
      )
      .limit(1);

    endpoints = ep ? [ep] : [];
  } else if (job.data.tenant_id) {
    endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        tenant_id: webhookEndpoints.tenant_id,
      })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.tenant_id, job.data.tenant_id),
          eq(webhookEndpoints.is_active, true),
        ),
      );

    // Filter to endpoints subscribed to this event
    // (events column is text[] — we check using raw SQL in a follow-up, but for simplicity filter in JS)
    endpoints = endpoints.filter((ep) => {
      // We need to re-query with events column; for now re-fetch
      return true; // Will be filtered below
    });

    // Re-query with events
    if (endpoints.length) {
      const fullEndpoints = await db
        .select({
          id: webhookEndpoints.id,
          url: webhookEndpoints.url,
          secret: webhookEndpoints.secret,
          tenant_id: webhookEndpoints.tenant_id,
          events: webhookEndpoints.events,
        })
        .from(webhookEndpoints)
        .where(
          and(
            eq(webhookEndpoints.tenant_id, job.data.tenant_id!),
            eq(webhookEndpoints.is_active, true),
          ),
        );

      endpoints = fullEndpoints
        .filter((ep) => ep.events?.includes(event))
        .map(({ events, ...rest }) => rest);
    }
  } else {
    return;
  }

  for (const endpoint of endpoints) {
    await deliverToEndpoint(endpoint, event, payload, job);
  }
}

async function deliverToEndpoint(
  endpoint: { id: string; url: string; secret: string; tenant_id: string },
  event: string,
  payload: Record<string, unknown>,
  job: Job,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', endpoint.secret)
    .update(body)
    .digest('hex');

  const startTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NexusFleet-Signature': `sha256=${signature}`,
        'X-NexusFleet-Event': event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    clearTimeout(timeout);

    // Check if we've exhausted attempts
    if (job.attemptsMade >= 4) {
      // 5th attempt (0-indexed: 4) — deactivate endpoint
      await db
        .update(webhookEndpoints)
        .set({
          is_active: false,
          failure_count: sql`failure_count + 1`,
        })
        .where(eq(webhookEndpoints.id, endpoint.id));

      // Notify tenant owner
      const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenant_id, endpoint.tenant_id),
            eq(users.role, 'owner'),
            eq(users.is_active, true),
          ),
        )
        .limit(1);

      if (owner) {
        await db.insert(notifications).values({
          tenant_id: endpoint.tenant_id,
          user_id: owner.id,
          type: 'error',
          title: 'Webhook endpoint deactivated',
          body: `Webhook endpoint ${endpoint.url} has been deactivated after 5 consecutive failures.`,
          data: { webhook_endpoint_id: endpoint.id },
        });
      }
    }

    throw err; // Re-throw for BullMQ retry
  }
}
