import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

// Routes that do not require authentication
const PUBLIC_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
];

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
    tenantId: string;
  }
}

function getPublicKey(): string { return process.env.JWT_PUBLIC_KEY ?? ''; }
const JWT_ALGORITHM = 'RS256';

const authPluginFn: FastifyPluginAsync = async (fastify) => {
  // Decorate request with default values
  fastify.decorateRequest('user', null as unknown as AuthUser);
  fastify.decorateRequest('tenantId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public routes
    const routeConfig = (request.routeOptions?.config as any) ?? {};
    if (routeConfig.skipAuth) {
      return;
    }

    const isPublic = PUBLIC_ROUTES.some(
      (route) => request.url === route || request.url.startsWith(route + '?'),
    );
    if (isPublic) {
      return;
    }

    // Skip auth for WebSocket upgrade requests that handle their own auth
    if (request.url.startsWith('/ws/')) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, getPublicKey(), {
        algorithms: [JWT_ALGORITHM],
      }) as { sub: string; tid: string; role: string };

      request.user = {
        userId: payload.sub,
        tenantId: payload.tid,
        role: payload.role,
      };
      request.tenantId = payload.tid;
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
  });
};

export const authPlugin = fp(authPluginFn, {
  name: 'auth',
});
