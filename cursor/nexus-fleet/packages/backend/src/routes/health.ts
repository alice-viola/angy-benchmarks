import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
      });
    },
  );
}

export default healthRoutes;
