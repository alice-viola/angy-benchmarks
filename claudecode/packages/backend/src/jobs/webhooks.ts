import { Worker, type Job } from 'bullmq';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

interface WebhookJobData {
  endpointId: string;
  tenantId: string;
  event: string;
  payload: Record<string, any>;
}

/**
 * Webhook Delivery Worker
 *
 * Signs payload with HMAC-SHA256, retries with exponential backoff (5 attempts).
 * Deactivates endpoint after 5 consecutive failures.
 */
export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { endpointId, tenantId, event, payload } = job.data;

      // Fetch endpoint
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .limit(1);

      if (!endpoint) {
        throw new Error(`Webhook endpoint ${endpointId} not found`);
      }

      if (!endpoint.is_active) {
        return { skipped: true, reason: 'Endpoint is inactive' };
      }

      // Build and sign payload
      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');

      // Deliver
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NexusFleet-Signature': signature,
          'X-NexusFleet-Event': event,
          'X-NexusFleet-Delivery': job.id ?? 'unknown',
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        // Increment consecutive failures
        const newFailureCount = endpoint.consecutive_failures + 1;

        await db
          .update(webhookEndpoints)
          .set({
            consecutive_failures: newFailureCount,
            last_triggered_at: new Date(),
            // Deactivate after 5 consecutive failures
            is_active: newFailureCount >= 5 ? false : endpoint.is_active,
            updated_at: new Date(),
          })
          .where(eq(webhookEndpoints.id, endpointId));

        throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
      }

      // Reset consecutive failures on success
      await db
        .update(webhookEndpoints)
        .set({
          consecutive_failures: 0,
          last_triggered_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpointId));

      return { delivered: true, status: response.status };
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000,
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[webhooks] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  return worker;
}
