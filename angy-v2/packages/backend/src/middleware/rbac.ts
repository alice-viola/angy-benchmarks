import { FastifyRequest, FastifyReply } from 'fastify';

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: null },
      });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
          details: null,
        },
      });
    }
  };
}
