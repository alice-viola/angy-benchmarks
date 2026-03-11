import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

export function requireRole(
  ...roles: string[]
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
        },
      });
    }
  };
}
