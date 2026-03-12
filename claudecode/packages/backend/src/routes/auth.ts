import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tenants, users } from '../db/schema.js';
import { loginSchema, registerSchema } from '@nexus-fleet/shared';

function getPrivateKey(): string { return process.env.JWT_PRIVATE_KEY ?? ''; }
function getPublicKey(): string { return process.env.JWT_PUBLIC_KEY ?? ''; }
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateAccessToken(payload: { sub: string; tid: string; role: string }): string {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(): string {
  return uuidv4() + '-' + uuidv4();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...rest] = c.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
}

function setRefreshCookie(reply: any, token: string) {
  const maxAge = REFRESH_TOKEN_EXPIRY_MS / 1000;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `refreshToken=${token}; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=${maxAge}${secure}`,
  );
}

function clearRefreshCookie(reply: any) {
  reply.header(
    'Set-Cookie',
    `refreshToken=; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=0`,
  );
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // POST /register
  // -------------------------------------------------------------------------
  fastify.post(
    '/register',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const { tenantName, email, password, firstName, lastName } = parsed.data;

      // Check if email already exists
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Email already registered' },
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const refreshToken = generateRefreshToken();
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      const tenantId = uuidv4();
      const userId = uuidv4();

      // Create tenant + owner user in transaction
      await db.transaction(async (tx) => {
        await tx.insert(tenants).values({
          id: tenantId,
          name: tenantName,
          slug: slugify(tenantName) + '-' + tenantId.slice(0, 8),
          plan: 'free',
        });

        await tx.insert(users).values({
          id: userId,
          tenant_id: tenantId,
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role: 'owner',
          refresh_token_hash: refreshTokenHash,
        });
      });

      const accessToken = generateAccessToken({ sub: userId, tid: tenantId, role: 'owner' });

      setRefreshCookie(reply, refreshToken);

      return reply.status(201).send({
        success: true,
        data: {
          accessToken,
          user: { id: userId, email, first_name: firstName, last_name: lastName, role: 'owner', tenant_id: tenantId },
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /login
  // -------------------------------------------------------------------------
  fastify.post(
    '/login',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const { email, password } = parsed.data;

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.is_active, true)))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
        });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
        });
      }

      const refreshToken = generateRefreshToken();
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      await db
        .update(users)
        .set({
          refresh_token_hash: refreshTokenHash,
          last_login_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(users.id, user.id));

      const accessToken = generateAccessToken({
        sub: user.id,
        tid: user.tenant_id,
        role: user.role,
      });

      setRefreshCookie(reply, refreshToken);

      return reply.send({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            tenant_id: user.tenant_id,
          },
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /refresh
  // -------------------------------------------------------------------------
  fastify.post(
    '/refresh',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const cookies = parseCookies(request.headers.cookie);
      const refreshToken =
        cookies.refreshToken ?? (request.body as any)?.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
        });
      }

      // Find users with a refresh token hash and compare
      const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.is_active, true));

      let matchedUser = null;
      for (const u of allUsers) {
        if (u.refresh_token_hash) {
          const matches = await bcrypt.compare(refreshToken, u.refresh_token_hash);
          if (matches) {
            matchedUser = u;
            break;
          }
        }
      }

      if (!matchedUser) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
        });
      }

      // Rotate refresh token
      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

      await db
        .update(users)
        .set({ refresh_token_hash: newRefreshTokenHash, updated_at: new Date() })
        .where(eq(users.id, matchedUser.id));

      const accessToken = generateAccessToken({
        sub: matchedUser.id,
        tid: matchedUser.tenant_id,
        role: matchedUser.role,
      });

      setRefreshCookie(reply, newRefreshToken);

      return reply.send({
        success: true,
        data: { accessToken },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /logout
  // -------------------------------------------------------------------------
  fastify.post('/logout', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    await db
      .update(users)
      .set({ refresh_token_hash: null, updated_at: new Date() })
      .where(eq(users.id, request.user.userId));

    clearRefreshCookie(reply);

    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
  });

  // -------------------------------------------------------------------------
  // GET /me
  // -------------------------------------------------------------------------
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        role: users.role,
        tenant_id: users.tenant_id,
        last_login_at: users.last_login_at,
        created_at: users.created_at,
      })
      .from(users)
      .where(
        and(eq(users.id, request.user.userId), eq(users.tenant_id, request.tenantId)),
      )
      .limit(1);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return reply.send({ success: true, data: user });
  });
};
