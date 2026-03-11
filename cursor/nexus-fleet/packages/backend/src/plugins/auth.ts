import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface AccessTokenPayload {
  sub: string;
  tid: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    auth: {
      generateAccessToken(payload: AccessTokenPayload): string;
      generateRefreshToken(): string;
      verifyAccessToken(token: string): AccessTokenPayload;
    };
  }
  interface FastifyRequest {
    user: { userId: string; tenantId: string; role: string };
  }
}

const ALLOWLISTED_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
]);

async function authPlugin(fastify: FastifyInstance) {
  const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
  const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;

  if (!privateKeyPath || !publicKeyPath) {
    throw new Error(
      'JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH environment variables are required',
    );
  }

  const privateKey = readFileSync(privateKeyPath, 'utf8');
  const publicKey = readFileSync(publicKeyPath, 'utf8');

  function generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });
  }

  function generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as AccessTokenPayload;
  }

  fastify.decorate('auth', {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
  });

  fastify.decorateRequest('user', null);

  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const urlPath = request.url.split('?')[0];
      if (ALLOWLISTED_PATHS.has(urlPath)) return;

      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        });
      }

      try {
        const payload = verifyAccessToken(header.slice(7));
        request.user = {
          userId: payload.sub,
          tenantId: payload.tid,
          role: payload.role,
        };
      } catch (err) {
        const message =
          err instanceof jwt.TokenExpiredError
            ? 'Token expired'
            : 'Invalid token';
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message },
        });
      }
    },
  );
}

export default fp(authPlugin, { name: 'auth' });
