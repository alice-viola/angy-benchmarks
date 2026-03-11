import type { Job } from 'bullmq';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';

interface WebhookJobData {
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

const MAX_ATTEMPTS = 5;

export async function processWebhookDelivery(job: Job<WebhookJobData>) {
  const { endpointId, event, payload, attempt = 1 } = job.data;

  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpointId));

  if (!endpoint) {
    throw new Error(`Webhook endpoint ${endpointId} not found`);
  }

  if (!endpoint.isActive) {
    return { skipped: true, reason: 'Endpoint deactivated' };
  }

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NexusFleet-Signature': `sha256=${signature}`,
        'X-NexusFleet-Event': event,
        'X-NexusFleet-Delivery': job.id ?? 'unknown',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await db
      .update(webhookEndpoints)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhookEndpoints.id, endpointId));

    return { delivered: true, statusCode: response.status, attempt };
  } catch (err: any) {
    if (attempt >= MAX_ATTEMPTS) {
      // Deactivate endpoint after max failures
      await db
        .update(webhookEndpoints)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(webhookEndpoints.id, endpointId));

      console.error(
        `[webhooks] Deactivated endpoint ${endpointId} after ${MAX_ATTEMPTS} failures`,
      );

      return {
        delivered: false,
        deactivated: true,
        lastError: err.message,
        attempts: attempt,
      };
    }

    // Exponential backoff: 2^attempt * 1000ms (2s, 4s, 8s, 16s, 32s)
    const backoffMs = Math.pow(2, attempt) * 1000;

    throw Object.assign(new Error(`Delivery failed (attempt ${attempt}): ${err.message}`), {
      retryDelay: backoffMs,
    });
  }
}
