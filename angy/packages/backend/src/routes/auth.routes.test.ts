/**
 * Smoke test: auth endpoints end-to-end
 * Mocks DB, Redis, and auth service. Uses real JWT RS256 with test keys.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

// ── Use vi.hoisted so keys are available inside hoisted vi.mock factories ────
const { testPublicKey, testPrivateKey } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const c = require('node:crypto');
  const pair = c.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testPublicKey: pair.publicKey as string, testPrivateKey: pair.privateKey as string };
});

// ── Shared mutable state for mock auth service ──────────────────────────────
let registeredUser: any = null;
let registeredTenant: any = null;

// ── Mock node:fs so readFileSync returns test keys ──────────────────────────
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    readFileSync: (path: string, ...args: any[]) => {
      if (typeof path === 'string' && path.includes('private')) return testPrivateKey;
      if (typeof path === 'string' && path.includes('public')) return testPublicKey;
      return original.readFileSync(path, ...args);
    },
  };
});

// ── Mock env ────────────────────────────────────────────────────────────────
vi.mock('../env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 0,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_PRIVATE_KEY_PATH: '/fake/private.pem',
    JWT_PUBLIC_KEY_PATH: '/fake/public.pem',
    JWT_ISSUER: 'nexus-fleet',
    JWT_AUDIENCE: 'nexus-fleet-api',
    JWT_ACCESS_TOKEN_TTL: 900,
    JWT_REFRESH_TOKEN_TTL: 604800,
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'silent',
  },
}));

// ── Mock Redis (not exercised directly, but tenant/rate-limit plugins import it) ──
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => {}),
  },
}));

// ── Mock DB connection (not exercised directly, but imported transitively) ──
vi.mock('../db/connection.js', () => ({ db: {} }));

// ── Mock auth service ───────────────────────────────────────────────────────
vi.mock('../services/auth.service.js', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const c = require('node:crypto');
  const jwtLib = require('jsonwebtoken');

  class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AuthError';
    }
  }

  return {
    AuthError,

    register: vi.fn(async (body: any) => {
      const userId = c.randomUUID();
      const tenantId = c.randomUUID();
      const refreshToken = c.randomBytes(32).toString('hex');

      registeredUser = {
        id: userId,
        email: body.email,
        role: 'owner',
        first_name: body.first_name,
        last_name: body.last_name,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      };
      registeredTenant = {
        id: tenantId,
        name: body.tenant_name,
        slug: body.tenant_name.toLowerCase().replace(/\s+/g, '-'),
        plan: 'free',
      };

      const accessToken = jwtLib.sign(
        { tid: tenantId, role: 'owner' },
        testPrivateKey,
        { algorithm: 'RS256', subject: userId, issuer: 'nexus-fleet', audience: 'nexus-fleet-api', expiresIn: 900 },
      );

      return {
        user: registeredUser,
        tenant: registeredTenant,
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    }),

    login: vi.fn(async (body: any) => {
      if (!registeredUser || body.email !== registeredUser.email) {
        throw new AuthError('Invalid email or password', 401);
      }

      const refreshToken = c.randomBytes(32).toString('hex');
      const accessToken = jwtLib.sign(
        { tid: registeredUser.tenant_id, role: 'owner' },
        testPrivateKey,
        { algorithm: 'RS256', subject: registeredUser.id, issuer: 'nexus-fleet', audience: 'nexus-fleet-api', expiresIn: 900 },
      );

      return {
        user: {
          id: registeredUser.id,
          email: registeredUser.email,
          role: 'owner',
          first_name: registeredUser.first_name,
          last_name: registeredUser.last_name,
          tenant_id: registeredUser.tenant_id,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    }),

    me: vi.fn(async (userId: string) => {
      if (!registeredUser || userId !== registeredUser.id) {
        throw new AuthError('User not found', 404);
      }
      return {
        user: { ...registeredUser, is_active: true, last_login_at: null },
        tenant: registeredTenant,
      };
    }),

    logout: vi.fn(async () => {}),
    refresh: vi.fn(async () => {
      throw new (class extends Error { statusCode = 401; name = 'AuthError'; })('Invalid refresh token');
    }),
  };
});

// ── Build Fastify app ───────────────────────────────────────────────────────
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import authPlugin from '../plugins/auth.plugin.js';
import authRoutes from '../routes/auth.routes.js';

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Auth smoke test', () => {
  let accessToken: string;

  it('POST /api/v1/auth/register → 201 with access_token and Set-Cookie refresh_token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: 'Test Corp',
        email: 'alice@test.com',
        password: 'strongpass123',
        first_name: 'Alice',
        last_name: 'Smith',
      },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.access_token).toBeDefined();
    expect(typeof body.data.access_token).toBe('string');
    expect(body.data.user).toBeDefined();
    expect(body.data.tenant).toBeDefined();

    // Verify Set-Cookie header contains refresh_token
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toContain('refresh_token=');

    accessToken = body.data.access_token;
  });

  it('POST /api/v1/auth/login → 200 with access_token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alice@test.com',
        password: 'strongpass123',
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.access_token).toBeDefined();
    expect(typeof body.data.access_token).toBe('string');
    expect(body.data.user).toBeDefined();

    accessToken = body.data.access_token;
  });

  it('GET /api/v1/auth/me with valid Bearer token → 200 with user+tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.tenant).toBeDefined();
    expect(body.data.user.email).toBe('alice@test.com');
  });

  it('GET /api/v1/auth/me without token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.statusCode).toBe(401);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
