import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Higher-order function that returns a Fastify preHandler hook.
 * Checks if the authenticated user's role is in the allowed roles list.
 *
 * @example
 *   fastify.post('/admin-only', { preHandler: [authorize('owner', 'admin')] }, handler)
 */
export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required role: ${roles.join(' or ')}`,
        },
      });
      return;
    }
  };
}
