import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { env } from '../env.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  sub: string;
  tid: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; tenantId: string; role: string };
  }
}

const ALLOWLIST = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
  '/ws/tracking',
  '/ws/dashboard',
];

const publicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf-8');

export default fp(
  async (app: FastifyInstance) => {
    app.decorateRequest('user', null);

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (ALLOWLIST.includes(request.url.split('?')[0])) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        });
      }

      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, publicKey, {
          algorithms: ['RS256'],
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
        }) as JwtPayload;

        request.user = {
          userId: decoded.sub,
          tenantId: decoded.tid,
          role: decoded.role,
        };
      } catch {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
      }
    });
  },
  { name: 'auth-plugin' },
);
