import fp from 'fastify-plugin';
import { redis } from '../lib/redis.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  pro: 500,
  enterprise: 2000,
};

const AUTH_LIMIT = 10;

const AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
];

function getWindowKey(prefix: string): { key: string; resetAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 60);
  const resetAt = windowStart + 60;
  return { key: `ratelimit:${prefix}:${windowStart}`, resetAt };
}

export default fp(
  async (app: FastifyInstance) => {
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url.split('?')[0] === '/health') return;

      const path = request.url.split('?')[0];
      const isAuthPath = AUTH_PATHS.includes(path);

      let identifier: string;
      let limit: number;

      if (isAuthPath) {
        identifier = `auth:${request.ip}`;
        limit = AUTH_LIMIT;
      } else if (request.tenant) {
        identifier = `tenant:${request.tenant.id}`;
        limit = PLAN_LIMITS[request.tenant.plan] ?? PLAN_LIMITS.free;
      } else {
        // No tenant context (unauthenticated non-auth request) — skip rate limiting
        return;
      }

      const { key, resetAt } = getWindowKey(identifier);

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 120); // expire well after window ends
      }

      reply.header('X-RateLimit-Limit', limit);
      reply.header('X-RateLimit-Remaining', Math.max(0, limit - count));
      reply.header('X-RateLimit-Reset', resetAt);

      if (count > limit) {
        return reply.status(429).send({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
        });
      }
    });
  },
  { name: 'rate-limit-plugin', dependencies: ['tenant-plugin'] },
);
