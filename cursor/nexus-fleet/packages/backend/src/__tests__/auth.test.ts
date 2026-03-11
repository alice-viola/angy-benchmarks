import { describe, it, expect, vi, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

// Generate an RSA key pair for testing (matches RS256 used in the auth plugin)
let privateKey: string;
let publicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

interface AccessTokenPayload {
  sub: string;
  tid: string;
  role: string;
}

function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
}

function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as AccessTokenPayload;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Password hashing and verification', () => {
  const BCRYPT_ROUNDS = 12;

  it('hashes a password and verifies it correctly', async () => {
    const password = 'SuperSecure!1';
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await bcrypt.hash('CorrectPassword!1', BCRYPT_ROUNDS);
    expect(await bcrypt.compare('WrongPassword!1', hash)).toBe(false);
  });

  it('produces different hashes for the same password (unique salt)', async () => {
    const password = 'SamePassword!1';
    const hash1 = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const hash2 = await bcrypt.hash(password, BCRYPT_ROUNDS);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });

  it('generated hash starts with expected bcrypt prefix', async () => {
    const hash = await bcrypt.hash('Test!123', BCRYPT_ROUNDS);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });
});

describe('JWT token generation and verification', () => {
  const testPayload: AccessTokenPayload = {
    sub: '550e8400-e29b-41d4-a716-446655440000',
    tid: '660e8400-e29b-41d4-a716-446655440000',
    role: 'admin',
  };

  it('generates a valid JWT that can be verified', () => {
    const token = generateAccessToken(testPayload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(testPayload.sub);
    expect(decoded.tid).toBe(testPayload.tid);
    expect(decoded.role).toBe(testPayload.role);
  });

  it('token contains iat and exp claims', () => {
    const token = generateAccessToken(testPayload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });

  it('token expires in 15 minutes', () => {
    const token = generateAccessToken(testPayload);
    const decoded = jwt.decode(token) as { iat: number; exp: number };

    const diffSeconds = decoded.exp - decoded.iat;
    expect(diffSeconds).toBe(15 * 60);
  });

  it('token header specifies RS256 algorithm', () => {
    const token = generateAccessToken(testPayload);
    const header = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    );

    expect(header.alg).toBe('RS256');
    expect(header.typ).toBe('JWT');
  });

  it('rejects a token signed with a different key', () => {
    const otherPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const badToken = jwt.sign(testPayload, otherPair.privateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    expect(() => verifyAccessToken(badToken)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = generateAccessToken(testPayload);
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.role = 'owner';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tampered = parts.join('.');

    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('Token expiry', () => {
  it('rejects an already-expired token', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-1', tid: 'tenant-1', role: 'viewer' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '0s' },
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow(jwt.TokenExpiredError);
  });

  it('verifyAccessToken throws TokenExpiredError with correct type', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-1', tid: 'tenant-1', role: 'viewer' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '-10s' },
    );

    try {
      verifyAccessToken(expiredToken);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(jwt.TokenExpiredError);
    }
  });
});

describe('Refresh token generation', () => {
  it('generates a 128-character hex string', () => {
    const token = generateRefreshToken();
    expect(token).toHaveLength(128);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(10);
  });
});
