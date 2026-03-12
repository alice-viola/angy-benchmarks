import { FastifyInstance } from 'fastify';
import {
  registerRequestSchema,
  loginRequestSchema,
} from '@nexusfleet/shared';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserWithTenant,
} from '../services/auth.service.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
};

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/register
  app.post('/register', async (request, reply) => {
    const parsed = registerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const result = await registerUser(parsed.data);

      reply.setCookie('refresh_token', result.refresh_token, REFRESH_COOKIE_OPTIONS);

      return reply.status(201).send({
        success: true,
        data: {
          user: result.user,
          tenant: result.tenant,
          access_token: result.access_token,
        },
      });
    } catch (err: any) {
      // Handle unique constraint violations (email or slug)
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Email or slug already exists',
            details: null,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const result = await loginUser(parsed.data.email, parsed.data.password);
    if (!result) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: null,
        },
      });
    }

    reply.setCookie('refresh_token', result.refresh_token, REFRESH_COOKIE_OPTIONS);

    return reply.status(200).send({
      success: true,
      data: {
        user: result.user,
        access_token: result.access_token,
      },
    });
  });

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
          details: null,
        },
      });
    }

    const result = await refreshAccessToken(refreshToken);
    if (!result) {
      // Clear invalid cookie
      reply.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
          details: null,
        },
      });
    }

    reply.setCookie('refresh_token', result.refresh_token, REFRESH_COOKIE_OPTIONS);

    return reply.status(200).send({
      success: true,
      data: {
        access_token: result.access_token,
      },
    });
  });

  // POST /api/v1/auth/logout
  app.post('/logout', async (request, reply) => {
    await logoutUser(request.user.id);
    reply.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);

    return reply.status(200).send({
      success: true,
      data: null,
    });
  });

  // GET /api/v1/auth/me
  app.get('/me', async (request, reply) => {
    const result = await getUserWithTenant(request.user.id, request.user.tenant_id);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: null,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  });
}
