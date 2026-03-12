import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// Generate a fresh RS256 key pair for tests (NOT production keys)
let privateKey: string;
let publicKey: string;
let wrongPrivateKey: string;

beforeAll(() => {
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  // A different key pair for "wrong key" tests
  const wrongPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  wrongPrivateKey = wrongPair.privateKey;
});

function signToken(
  payload: Record<string, any>,
  key: string = privateKey,
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, key, {
    algorithm: 'RS256',
    expiresIn: '1h',
    ...options,
  });
}

async function buildApp(): Promise<FastifyInstance> {
  // Set the public key env before importing the plugin
  process.env.JWT_PUBLIC_KEY = publicKey;

  // Dynamically import to pick up the env var
  const { authPlugin } = await import('../plugins/auth.js');

  const app = Fastify({ logger: false });
  await app.register(authPlugin);

  // Test route that requires auth
  app.get('/api/v1/test', async (request) => {
    return { user: request.user };
  });

  // The allowlisted routes
  app.post('/api/v1/auth/login', async () => {
    return { success: true };
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  await app.ready();
  return app;
}

describe('auth-middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe('valid token', () => {
    it('populates request.user with correct fields from RS256 JWT', async () => {
      const token = signToken({
        sub: 'user-123',
        tid: 'tenant-456',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user).toEqual({
        id: 'user-123',
        tenant_id: 'tenant-456',
        role: 'admin',
      });
    });
  });

  describe('expired token', () => {
    it('returns 401 with UNAUTHORIZED code', async () => {
      const token = signToken(
        { sub: 'user-123', tid: 'tenant-456', role: 'admin' },
        privateKey,
        { expiresIn: '-1s' },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('missing Authorization header', () => {
    it('returns 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('JWT signed with wrong key', () => {
    it('returns 401', async () => {
      const token = signToken(
        { sub: 'user-123', tid: 'tenant-456', role: 'admin' },
        wrongPrivateKey,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('allowlisted routes', () => {
    it('/api/v1/auth/login with no token passes through (no 401)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
      });

      // Should not be 401 — allowlisted
      expect(response.statusCode).not.toBe(401);
    });

    it('/health with no token passes through', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('JWT with mismatched tenant', () => {
    it('populates request.user with the tenant from the JWT (tenant isolation is enforced elsewhere)', async () => {
      // The auth middleware itself does not check tenant against URL params
      // — it trusts the JWT. Tenant isolation is in the service layer.
      // But the token is valid, so it should pass auth.
      const token = signToken({
        sub: 'user-123',
        tid: 'tenant-WRONG',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: `Bearer ${token}` },
      });

      // Auth passes — tenant filtering happens in DB queries
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.tenant_id).toBe('tenant-WRONG');
    });
  });

  describe('malformed tokens', () => {
    it('Bearer with garbage string returns 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: 'Bearer not.a.valid.jwt' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('Authorization header without Bearer prefix returns 401', async () => {
      const token = signToken({ sub: 'user-123', tid: 'tenant-456', role: 'admin' });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: { authorization: token },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
