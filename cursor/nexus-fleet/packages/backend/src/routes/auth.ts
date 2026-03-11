import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { loginSchema, registerSchema } from '@nexus-fleet/shared';
import { db } from '../db/connection.js';
import { users, tenants } from '../db/schema.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AccessTokenPayload } from '../plugins/auth.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    }),
  );
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `refresh_token=${token}; HttpOnly${secure}; SameSite=Strict; Path=/api/v1/auth; Max-Age=${REFRESH_TOKEN_TTL}`,
  );
}

function clearRefreshCookie(reply: FastifyReply) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `refresh_token=; HttpOnly${secure}; SameSite=Strict; Path=/api/v1/auth; Max-Age=0`,
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function storeRefreshToken(
  fastify: FastifyInstance,
  userId: string,
  token: string,
) {
  const key = `rt:${userId}`;
  const hashed = await bcrypt.hash(token, BCRYPT_ROUNDS);
  await fastify.redis.set(key, hashed, 'EX', REFRESH_TOKEN_TTL);
}

async function validateRefreshToken(
  fastify: FastifyInstance,
  userId: string,
  token: string,
): Promise<boolean> {
  const stored = await fastify.redis.get(`rt:${userId}`);
  if (!stored) return false;
  return bcrypt.compare(token, stored);
}

async function authRoutes(fastify: FastifyInstance) {
  // -----------------------------------------------------------------------
  // POST /register
  // -----------------------------------------------------------------------
  fastify.post(
    '/register',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten(),
          },
        });
      }

      const { email, password, name, tenantName } = parsed.data;
      const slug = slugify(tenantName);

      const existingTenant = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);

      if (existingTenant.length > 0) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'TENANT_EXISTS',
            message: 'A tenant with this name already exists',
          },
        });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const [tenant] = await db
        .insert(tenants)
        .values({ name: tenantName, slug })
        .returning();

      const [user] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          passwordHash,
          name,
          role: 'owner',
        })
        .returning();

      const tokenPayload: AccessTokenPayload = {
        sub: user.id,
        tid: tenant.id,
        role: user.role,
      };
      const accessToken = fastify.auth.generateAccessToken(tokenPayload);
      const refreshToken = fastify.auth.generateRefreshToken();

      await storeRefreshToken(fastify, user.id, refreshToken);
      setRefreshCookie(reply, refreshToken);

      return reply.status(201).send({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: tenant.id,
          },
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /login
  // -----------------------------------------------------------------------
  fastify.post(
    '/login',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten(),
          },
        });
      }

      const { email, password } = parsed.data;

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.isActive, true)))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const tokenPayload: AccessTokenPayload = {
        sub: user.id,
        tid: user.tenantId,
        role: user.role,
      };
      const accessToken = fastify.auth.generateAccessToken(tokenPayload);
      const refreshToken = fastify.auth.generateRefreshToken();

      await storeRefreshToken(fastify, user.id, refreshToken);
      setRefreshCookie(reply, refreshToken);

      return reply.send({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
          },
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /refresh
  // -----------------------------------------------------------------------
  fastify.post(
    '/refresh',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookies = parseCookies(request.headers.cookie);
      const refreshToken = cookies.refresh_token;

      if (!refreshToken) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Refresh token not found' },
        });
      }

      // Decode the expired access token from Authorization header to identify the user.
      // The header is optional here; fall back to looking up all stored tokens.
      const authHeader = request.headers.authorization;
      let userId: string | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = fastify.auth.verifyAccessToken(authHeader.slice(7));
          userId = decoded.sub;
        } catch {
          // Token might be expired – decode without verification to get the subject
          const jwt = await import('jsonwebtoken');
          const payload = jwt.default.decode(authHeader.slice(7)) as Record<
            string,
            unknown
          > | null;
          userId = payload?.sub as string | undefined;
        }
      }

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unable to identify user for token refresh' },
        });
      }

      const valid = await validateRefreshToken(fastify, userId, refreshToken);
      if (!valid) {
        await fastify.redis.del(`rt:${userId}`);
        clearRefreshCookie(reply);
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), eq(users.isActive, true)))
        .limit(1);

      if (!user) {
        await fastify.redis.del(`rt:${userId}`);
        clearRefreshCookie(reply);
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not found or inactive' },
        });
      }

      const tokenPayload: AccessTokenPayload = {
        sub: user.id,
        tid: user.tenantId,
        role: user.role,
      };
      const newAccessToken = fastify.auth.generateAccessToken(tokenPayload);
      const newRefreshToken = fastify.auth.generateRefreshToken();

      await storeRefreshToken(fastify, user.id, newRefreshToken);
      setRefreshCookie(reply, newRefreshToken);

      return reply.send({
        success: true,
        data: { accessToken: newAccessToken },
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /logout
  // -----------------------------------------------------------------------
  fastify.post(
    '/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.user) {
        await fastify.redis.del(`rt:${request.user.userId}`);
      }

      clearRefreshCookie(reply);

      return reply.send({ success: true, data: null });
    },
  );

  // -----------------------------------------------------------------------
  // GET /me
  // -----------------------------------------------------------------------
  fastify.get(
    '/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const [user] = await db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, request.user.userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      return reply.send({ success: true, data: user });
    },
  );
}

export default authRoutes;
