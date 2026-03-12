import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Redis as IORedis } from 'ioredis';
import { RATE_LIMITS_BY_PLAN, AUTH_RATE_LIMIT } from '@nexusfleet/shared';

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.connect().catch(() => {
      // Redis unavailable — rate limiting will be bypassed
    });
  }
  return redis;
}

function isAuthEndpoint(url: string): boolean {
  return url.startsWith('/api/v1/auth/');
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const r = getRedis();
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = Math.ceil((now + windowMs) / 1000);

  try {
    const pipeline = r.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    pipeline.zcard(key);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining, resetAt };
  } catch {
    // Redis down — allow request through
    return { allowed: true, remaining: limit, resetAt };
  }
}

async function rateLimiterPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    let key: string;
    let limit: number;
    let windowMs: number;

    if (isAuthEndpoint(request.url)) {
      // Auth endpoints: per-IP
      const ip = request.ip;
      key = `rl:auth:${ip}`;
      limit = AUTH_RATE_LIMIT.requests;
      windowMs = AUTH_RATE_LIMIT.window_seconds * 1000;
    } else {
      // Regular endpoints: per-tenant
      const user = (request as any).user;
      if (!user?.tenant_id) {
        // Not authenticated yet or allowlisted — skip tenant rate limiting
        return;
      }
      // We need the tenant plan. For now use a default; the auth plugin has
      // already decoded the JWT by this point. We store plan in a lightweight
      // Redis cache keyed by tenant_id, populated on first request.
      const planKey = `tenant_plan:${user.tenant_id}`;
      const r = getRedis();
      let plan = 'free';
      try {
        const cached = await r.get(planKey);
        if (cached) plan = cached;
      } catch {
        // ignore
      }

      const planConfig = RATE_LIMITS_BY_PLAN[plan] ?? RATE_LIMITS_BY_PLAN['free'];
      key = `rl:tenant:${user.tenant_id}`;
      limit = planConfig.requests_per_second;
      windowMs = 1000; // 1 second window
    }

    const result = await checkRateLimit(key, limit, windowMs);

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          details: null,
        },
      });
    }
  });
}

export const rateLimiterPlugin = fp(rateLimiterPluginImpl, { name: 'rate-limiter' });
