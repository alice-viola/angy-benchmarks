import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tenants } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_vehicles: number;
  max_drivers: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantInfo;
  }
}

const TENANT_CACHE_TTL = 60; // seconds

export default fp(
  async (app: FastifyInstance) => {
    app.decorateRequest('tenant', null);

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) return;

      const tenantId = request.user.tenantId;
      const cacheKey = `tenant:${tenantId}`;

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        request.tenant = JSON.parse(cached);
        return;
      }

      // Load from DB
      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.plan,
          max_vehicles: tenants.max_vehicles,
          max_drivers: tenants.max_drivers,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant not found' },
        });
      }

      const tenantInfo: TenantInfo = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        max_vehicles: tenant.max_vehicles,
        max_drivers: tenant.max_drivers,
      };

      // Cache in Redis
      await redis.set(cacheKey, JSON.stringify(tenantInfo), 'EX', TENANT_CACHE_TTL);

      request.tenant = tenantInfo;
    });
  },
  { name: 'tenant-plugin', dependencies: ['auth-plugin'] },
);
