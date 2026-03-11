import { eq, and, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Database } from '../db/connection.js';
import * as schema from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookJobData {
  endpointId: string;
  event: string;
  payload: WebhookPayload;
  attempt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const SIGNATURE_HEADER = 'X-NexusFleet-Signature';
const DELIVERY_TIMEOUT_MS = 10_000;

function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 300_000);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WebhookService {
  private queue: Queue<WebhookJobData>;

  constructor(
    private db: Database,
    private redis: Redis,
  ) {
    this.queue = new Queue<WebhookJobData>('webhooks', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async dispatchWebhook(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<number> {
    const endpoints = await this.db
      .select()
      .from(schema.webhookEndpoints)
      .where(
        and(
          eq(schema.webhookEndpoints.tenantId, tenantId),
          eq(schema.webhookEndpoints.isActive, true),
        ),
      );

    const matching = endpoints.filter((ep) =>
      ep.events.includes(event),
    );

    if (matching.length === 0) return 0;

    const webhookPayload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const jobs = matching.map((ep) => ({
      name: `webhook:${event}`,
      data: {
        endpointId: ep.id,
        event,
        payload: webhookPayload,
        attempt: 0,
      } satisfies WebhookJobData,
      opts: {
        jobId: `wh:${ep.id}:${Date.now()}`,
      },
    }));

    await this.queue.addBulk(jobs);
    return matching.length;
  }

  async deliverWebhook(
    endpointId: string,
    event: string,
    payload: WebhookPayload,
    attempt = 0,
  ): Promise<boolean> {
    const [endpoint] = await this.db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.id, endpointId));

    if (!endpoint || !endpoint.isActive) return false;

    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        await this.db
          .update(schema.webhookEndpoints)
          .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.webhookEndpoints.id, endpointId));
        return true;
      }

      return await this.handleFailure(endpointId, event, payload, attempt, `HTTP ${response.status}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return await this.handleFailure(endpointId, event, payload, attempt, message);
    }
  }

  private async handleFailure(
    endpointId: string,
    event: string,
    payload: WebhookPayload,
    attempt: number,
    reason: string,
  ): Promise<boolean> {
    const nextAttempt = attempt + 1;

    if (nextAttempt >= MAX_RETRIES) {
      await this.db
        .update(schema.webhookEndpoints)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.webhookEndpoints.id, endpointId));
      return false;
    }

    await this.queue.add(
      `webhook:${event}:retry`,
      { endpointId, event, payload, attempt: nextAttempt },
      { delay: backoffDelay(nextAttempt), jobId: `wh:${endpointId}:retry:${nextAttempt}:${Date.now()}` },
    );

    return false;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
