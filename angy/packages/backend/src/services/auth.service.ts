import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import slugify from 'slugify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users, tenants } from '../db/schema.js';
import { env } from '../env.js';
import type { RegisterInput, LoginInput } from '@nexus-fleet/shared';

const privateKey = readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf-8');

const BCRYPT_ROUNDS = 12;

function generateAccessToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign(
    { tid: tenantId, role },
    privateKey,
    {
      algorithm: 'RS256',
      subject: userId,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_ACCESS_TOKEN_TTL,
    },
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true });
  // Check if base slug is available
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, base))
    .limit(1);

  if (!existing) return base;

  // Append random hex suffix on collision
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}

export async function register(body: RegisterInput) {
  const slug = await generateUniqueSlug(body.tenant_name);
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

  // Create tenant + owner user in a single transaction
  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: body.tenant_name,
        slug,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        tenant_id: tenant.id,
        email: body.email,
        password_hash: passwordHash,
        refresh_token: refreshTokenHash,
        role: 'owner',
        first_name: body.first_name,
        last_name: body.last_name,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        first_name: users.first_name,
        last_name: users.last_name,
        tenant_id: users.tenant_id,
        created_at: users.created_at,
      });

    return { tenant, user };
  });

  const accessToken = generateAccessToken(
    result.user.id,
    result.tenant.id,
    result.user.role,
  );

  return {
    user: result.user,
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      plan: result.tenant.plan,
    },
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export async function login(body: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, body.email), eq(users.is_active, true)))
    .limit(1);

  if (!user) {
    throw new AuthError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(body.password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 401);
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({
      refresh_token: refreshTokenHash,
      last_login_at: new Date(),
    })
    .where(eq(users.id, user.id));

  const accessToken = generateAccessToken(user.id, user.tenant_id, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      tenant_id: user.tenant_id,
    },
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export async function refresh(cookieToken: string) {
  // Find users who have a refresh token stored
  const allUsersWithToken = await db
    .select()
    .from(users)
    .where(and(eq(users.is_active, true)));

  // Find the user whose stored hash matches the cookie token
  let matchedUser = null;
  for (const u of allUsersWithToken) {
    if (!u.refresh_token) continue;
    const matches = await bcrypt.compare(cookieToken, u.refresh_token);
    if (matches) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    throw new AuthError('Invalid refresh token', 401);
  }

  // Rotate tokens
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({ refresh_token: newRefreshTokenHash })
    .where(eq(users.id, matchedUser.id));

  const accessToken = generateAccessToken(
    matchedUser.id,
    matchedUser.tenant_id,
    matchedUser.role,
  );

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
  };
}

export async function logout(userId: string) {
  await db
    .update(users)
    .set({ refresh_token: null })
    .where(eq(users.id, userId));
}

export async function me(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      tenant_id: users.tenant_id,
      is_active: users.is_active,
      last_login_at: users.last_login_at,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AuthError('User not found', 404);
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.plan,
      max_vehicles: tenants.max_vehicles,
      max_drivers: tenants.max_drivers,
    })
    .from(tenants)
    .where(eq(tenants.id, user.tenant_id))
    .limit(1);

  return { user, tenant };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
