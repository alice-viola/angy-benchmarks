import bcrypt from 'bcrypt';
import { eq, and, count, desc, ne } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { ServiceError } from './vehicle.service.js';

const BCRYPT_ROUNDS = 12;

const safeColumns = {
  id: users.id,
  tenant_id: users.tenant_id,
  email: users.email,
  role: users.role,
  first_name: users.first_name,
  last_name: users.last_name,
  is_active: users.is_active,
  last_login_at: users.last_login_at,
  created_at: users.created_at,
  updated_at: users.updated_at,
};

interface ListParams {
  tenantId: string;
  role?: string;
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(users.tenant_id, tenantId)];
  if (params.role) {
    conditions.push(eq(users.role, params.role as any));
  }
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db.select(safeColumns).from(users).where(where).orderBy(desc(users.created_at)).limit(limit).offset(offset),
    db.select({ count: count() }).from(users).where(where),
  ]);

  return {
    data: items,
    meta: { totalItems: total.count, page, pageSize: limit, totalPages: Math.ceil(total.count / limit) },
  };
}

export async function getById(tenantId: string, id: string) {
  const [user] = await db
    .select(safeColumns)
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
    .limit(1);

  if (!user) throw new ServiceError('User not found', 404, 'NOT_FOUND');
  return user;
}

export async function create(tenantId: string, data: any, requestingUserRole: string) {
  // Cannot create owner role
  if (data.role === 'owner') {
    throw new ServiceError('Cannot create a user with owner role', 403, 'FORBIDDEN');
  }

  // Only owner can create admin
  if (data.role === 'admin' && requestingUserRole !== 'owner') {
    throw new ServiceError('Only owner can create admin users', 403, 'FORBIDDEN');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      tenant_id: tenantId,
      email: data.email,
      password_hash: passwordHash,
      role: data.role,
      first_name: data.first_name,
      last_name: data.last_name,
    })
    .returning(safeColumns)
    .catch((err: any) => {
      if (err.code === '23505') {
        throw new ServiceError('A user with this email already exists', 409, 'DUPLICATE');
      }
      throw err;
    });

  return user;
}

export async function update(tenantId: string, id: string, data: any, requestingUserId: string, requestingUserRole: string) {
  await getById(tenantId, id);

  // Cannot change own role
  if (data.role !== undefined && id === requestingUserId) {
    throw new ServiceError('Cannot change your own role', 409, 'SELF_ROLE_CHANGE');
  }

  // Cannot set role to owner
  if (data.role === 'owner') {
    throw new ServiceError('Cannot set role to owner', 403, 'FORBIDDEN');
  }

  const updateData: any = {};
  if (data.first_name !== undefined) updateData.first_name = data.first_name;
  if (data.last_name !== undefined) updateData.last_name = data.last_name;
  if (data.role !== undefined) updateData.role = data.role;

  if (Object.keys(updateData).length === 0) {
    return getById(tenantId, id);
  }

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
    .returning(safeColumns);

  return user;
}

export async function softDelete(tenantId: string, id: string, requestingUserId: string) {
  const user = await getById(tenantId, id);

  // Cannot deactivate self
  if (id === requestingUserId) {
    throw new ServiceError('Cannot deactivate yourself', 409, 'SELF_DEACTIVATE');
  }

  // Cannot deactivate last owner
  if (user.role === 'owner') {
    const [{ count: ownerCount }] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.tenant_id, tenantId), eq(users.role, 'owner'), eq(users.is_active, true)));

    if (ownerCount <= 1) {
      throw new ServiceError('Cannot deactivate the last owner', 409, 'LAST_OWNER');
    }
  }

  const [updated] = await db
    .update(users)
    .set({ is_active: false })
    .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
    .returning(safeColumns);

  return updated;
}
