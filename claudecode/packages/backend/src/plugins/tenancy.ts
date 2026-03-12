import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/connection.js';
import { eq, and, type SQL } from 'drizzle-orm';

export interface TenantContext {
  tenantId: string;
  /** Helper to add tenant_id = ? condition to any query */
  withTenant<T extends { tenant_id: any }>(
    table: T,
  ): SQL;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantCtx: TenantContext;
  }
}

const tenancyPluginFn: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('tenantCtx', null as unknown as TenantContext);

  fastify.addHook('onRequest', async (request) => {
    if (!request.tenantId) {
      return;
    }

    request.tenantCtx = {
      tenantId: request.tenantId,
      withTenant<T extends { tenant_id: any }>(table: T): SQL {
        return eq(table.tenant_id, request.tenantId);
      },
    };
  });
};

export const tenancyPlugin = fp(tenancyPluginFn, {
  name: 'tenancy',
  dependencies: ['auth'],
});

/**
 * Helper function for tenant-scoped queries. Use in route handlers:
 *   tenantScope(schema.vehicles, request.tenantId)
 */
export function tenantScope<T extends { tenant_id: any }>(
  table: T,
  tenantId: string,
): SQL {
  return eq(table.tenant_id, tenantId);
}
