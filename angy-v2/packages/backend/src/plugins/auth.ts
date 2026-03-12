import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      tenant_id: string;
      role: string;
    };
  }
}

const ALLOWLIST = [
  { method: 'POST', url: '/api/v1/auth/login' },
  { method: 'POST', url: '/api/v1/auth/register' },
  { method: 'POST', url: '/api/v1/auth/refresh' },
  { method: 'GET', url: '/health' },
  { method: 'GET', url: '/ws/' },
];

function isAllowlisted(method: string, url: string): boolean {
  return ALLOWLIST.some(
    (entry) => entry.method === method && url.startsWith(entry.url),
  );
}

async function authPluginImpl(app: FastifyInstance) {
  const publicKey = process.env.JWT_PUBLIC_KEY;
  if (!publicKey) {
    app.log.warn('JWT_PUBLIC_KEY not set — auth will reject all tokens');
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isAllowlisted(request.method, request.url)) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header', details: null },
      });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, publicKey!, { algorithms: ['RS256'] }) as {
        sub: string;
        tid: string;
        role: string;
      };

      request.user = {
        id: decoded.sub,
        tenant_id: decoded.tid,
        role: decoded.role,
      };

      // Augment logger with tenant/user context
      request.log = request.log.child({
        tenant_id: decoded.tid,
        user_id: decoded.sub,
      });
    } catch {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', details: null },
      });
    }
  });
}

export const authPlugin = fp(authPluginImpl, { name: 'auth' });
