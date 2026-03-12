import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tenants, users } from '../db/schema.js';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '15m';

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) throw new Error('JWT_PRIVATE_KEY not set');
  return key;
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY not set');
  return key;
}

export function signAccessToken(payload: { sub: string; tid: string; role: string }): string {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): { sub: string; tid: string; role: string } {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as {
    sub: string;
    tid: string;
    role: string;
  };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_COST);
}

export async function compareRefreshToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

export interface RegisterInput {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  // Transaction: create tenant + owner user
  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.tenant_name,
        slug: input.tenant_slug,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        tenant_id: tenant.id,
        email: input.email,
        password_hash: passwordHash,
        role: 'owner',
        first_name: input.first_name,
        last_name: input.last_name,
        refresh_token_hash: refreshTokenHash,
      })
      .returning();

    return { tenant, user };
  });

  const accessToken = signAccessToken({
    sub: result.user.id,
    tid: result.tenant.id,
    role: 'owner',
  });

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      first_name: result.user.first_name,
      last_name: result.user.last_name,
    },
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
    },
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export async function loginUser(email: string, password: string) {
  // Find user by email (across all tenants for login)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.is_active, true)))
    .limit(1);

  if (!user) return null;

  const passwordValid = await comparePassword(password, user.password_hash);
  if (!passwordValid) return null;

  // Update last_login_at
  await db
    .update(users)
    .set({ last_login_at: new Date(), updated_at: new Date() })
    .where(eq(users.id, user.id));

  // Generate tokens
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  await db
    .update(users)
    .set({ refresh_token_hash: refreshTokenHash })
    .where(eq(users.id, user.id));

  const accessToken = signAccessToken({
    sub: user.id,
    tid: user.tenant_id,
    role: user.role,
  });

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

export async function refreshAccessToken(refreshToken: string) {
  // Find any user whose refresh_token_hash matches
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.is_active, true));

  let matchedUser = null;
  for (const user of allUsers) {
    if (!user.refresh_token_hash) continue;
    const matches = await compareRefreshToken(refreshToken, user.refresh_token_hash);
    if (matches) {
      matchedUser = user;
      break;
    }
  }

  if (!matchedUser) return null;

  // Invalidate old token
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

  await db
    .update(users)
    .set({ refresh_token_hash: newRefreshTokenHash, updated_at: new Date() })
    .where(eq(users.id, matchedUser.id));

  const accessToken = signAccessToken({
    sub: matchedUser.id,
    tid: matchedUser.tenant_id,
    role: matchedUser.role,
  });

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
  };
}

export async function logoutUser(userId: string) {
  await db
    .update(users)
    .set({ refresh_token_hash: null, updated_at: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserWithTenant(userId: string, tenantId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      tenant_id: users.tenant_id,
      tenant_name: tenants.name,
      tenant_slug: tenants.slug,
      tenant_plan: tenants.plan,
      tenant_table_id: tenants.id,
    })
    .from(users)
    .innerJoin(tenants, eq(users.tenant_id, tenants.id))
    .where(and(eq(users.id, userId), eq(users.tenant_id, tenantId)))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    tenant_id: user.tenant_id,
    tenant: {
      id: user.tenant_table_id,
      name: user.tenant_name,
      slug: user.tenant_slug,
      plan: user.tenant_plan,
    },
  };
}
