/**
 * Auth middleware tests — JWT verification via Fastify auth plugin.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

// ── RSA key pair ────────────────────────────────────────────────────────────
const { testPublicKey, testPrivateKey } = vi.hoisted(() => {
  const c = require('node:crypto');
  const pair = c.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testPublicKey: pair.publicKey as string, testPrivateKey: pair.privateKey as string };
});

// Second key pair for "wrong key" test
const { wrongPrivateKey } = vi.hoisted(() => {
  const c = require('node:crypto');
  const pair = c.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { wrongPrivateKey: pair.privateKey as string };
});

const TENANT_ID = crypto.randomUUID();
const USER_ID = crypto.randomUUID();

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

vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => {}),
  },
}));

vi.mock('../db/connection.js', () => ({ db: {} }));

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from 'jsonwebtoken';
import authPlugin from '../plugins/auth.plugin.js';

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(authPlugin);

  // A protected test route
  app.get('/api/v1/test', async (request: any) => {
    return { success: true, user: request.user };
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function signToken(payload: Record<string, any>, privateKey: string, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    issuer: 'nexus-fleet',
    audience: 'nexus-fleet-api',
    expiresIn: 900,
    ...options,
  });
}

describe('Auth middleware', () => {
  it('valid RS256 JWT → request.user populated correctly', async () => {
    const token = signToken({ tid: TENANT_ID, role: 'admin' }, testPrivateKey, { subject: USER_ID });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toEqual({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: 'admin',
    });
  });

  it('expired JWT → 401', async () => {
    const token = signToken({ tid: TENANT_ID, role: 'admin' }, testPrivateKey, {
      subject: USER_ID,
      expiresIn: -10, // already expired
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('missing Authorization header → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('JWT signed with wrong key → 401', async () => {
    const token = signToken({ tid: TENANT_ID, role: 'admin' }, wrongPrivateKey, { subject: USER_ID });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('JWT with wrong issuer → 401', async () => {
    const token = jwt.sign({ tid: TENANT_ID, role: 'admin' }, testPrivateKey, {
      algorithm: 'RS256',
      subject: USER_ID,
      issuer: 'wrong-issuer',
      audience: 'nexus-fleet-api',
      expiresIn: 900,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });
});
