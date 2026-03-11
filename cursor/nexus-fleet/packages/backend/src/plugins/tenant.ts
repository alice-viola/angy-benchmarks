import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/connection.js';
import { tenants } from '../db/schema.js';
import { RATE_LIMITS } from '@nexus-fleet/shared';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantInfo;
  }
}

const CACHE_TTL = 60;

const SKIP_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
]);

async function tenantPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('tenant', null);

  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const urlPath = request.url.split('?')[0];
      if (SKIP_PATHS.has(urlPath)) return;
      if (!request.user) return;

      const { tenantId } = request.user;
      const cacheKey = `tenant:${tenantId}`;

      let tenantInfo: TenantInfo | null = null;

      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        tenantInfo = JSON.parse(cached);
      } else {
        const [row] = await db
          .select({
            id: tenants.id,
            name: tenants.name,
            slug: tenants.slug,
            plan: tenants.plan,
            isActive: tenants.isActive,
          })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (row) {
          tenantInfo = row;
          await fastify.redis.set(cacheKey, JSON.stringify(row), 'EX', CACHE_TTL);
        }
      }

      if (!tenantInfo || !tenantInfo.isActive) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'TENANT_INACTIVE',
            message: 'Tenant account is not active',
          },
        });
      }

      request.tenant = tenantInfo;

      const rlKey = `rl:${tenantId}:${Math.floor(Date.now() / 60_000)}`;
      const count = await fastify.redis.incr(rlKey);
      if (count === 1) {
        await fastify.redis.expire(rlKey, 60);
      }

      const limit =
        (RATE_LIMITS as Record<string, number>)[tenantInfo.plan] ?? 100;
      if (count > limit) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Tenant rate limit exceeded (${limit} requests/min for ${tenantInfo.plan} plan)`,
          },
        });
      }
    },
  );
}

export default fp(tenantPlugin, {
  name: 'tenant',
  dependencies: ['auth', 'redis'],
});
