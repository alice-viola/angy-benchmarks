import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from '@nexus-fleet/shared';
import * as authService from '../services/auth.service.js';
import { AuthError } from '../services/auth.service.js';
import { env } from '../env.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.JWT_REFRESH_TOKEN_TTL,
};

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body);

    reply.setCookie(REFRESH_COOKIE_NAME, result.refresh_token, COOKIE_OPTIONS);

    return reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        tenant: result.tenant,
        access_token: result.access_token,
      },
    });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body);

    reply.setCookie(REFRESH_COOKIE_NAME, result.refresh_token, COOKIE_OPTIONS);

    return reply.status(200).send({
      success: true,
      data: {
        user: result.user,
        access_token: result.access_token,
      },
    });
  });

  app.post('/refresh', async (request, reply) => {
    const cookieToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!cookieToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
      });
    }

    const result = await authService.refresh(cookieToken);

    reply.setCookie(REFRESH_COOKIE_NAME, result.refresh_token, COOKIE_OPTIONS);

    return reply.status(200).send({
      success: true,
      data: { access_token: result.access_token },
    });
  });

  app.post('/logout', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    await authService.logout(request.user.userId);

    reply.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/api/v1/auth',
    });

    return reply.status(200).send({ success: true, data: null });
  });

  app.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const result = await authService.me(request.user.userId);

    return reply.status(200).send({ success: true, data: result });
  });

  // Global error handler for auth routes
  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: 'AUTH_ERROR', message: error.message },
      });
    }

    // Zod validation errors
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: (error as any).issues },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
}
