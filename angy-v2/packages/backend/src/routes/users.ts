import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { userCreateRequestSchema, userUpdateRequestSchema } from '@nexusfleet/shared';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { requireRole } from '../middleware/rbac.js';
import { hashPassword } from '../services/auth.service.js';

function formatUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    is_active: user.is_active,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    created_at: user.created_at?.toISOString() ?? '',
  };
}

export async function userRoutes(app: FastifyInstance) {
  const preHandler = requireRole('owner', 'admin');

  // GET /api/v1/users
  app.get('/', { preHandler }, async (request) => {
    const tenantId = request.user.tenant_id;

    const result = await db
      .select()
      .from(users)
      .where(eq(users.tenant_id, tenantId));

    return {
      success: true,
      data: result.map(formatUser),
    };
  });

  // POST /api/v1/users
  app.post('/', { preHandler }, async (request, reply) => {
    const parsed = userCreateRequestSchema.safeParse(request.body);
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

    const { email, password, role, first_name, last_name } = parsed.data;

    // Role creation restrictions
    if ((role as string) === 'owner') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot create an owner user', details: null },
      });
    }
    if (request.user.role === 'admin' && role === 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admins cannot create other admins', details: null },
      });
    }

    const passwordHash = await hashPassword(password);

    try {
      const [user] = await db
        .insert(users)
        .values({
          tenant_id: request.user.tenant_id,
          email,
          password_hash: passwordHash,
          role,
          first_name,
          last_name,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: formatUser(user),
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Email already exists within this tenant', details: null },
        });
      }
      throw err;
    }
  });

  // PUT /api/v1/users/:id
  app.put<{ Params: { id: string } }>('/:id', { preHandler }, async (request, reply) => {
    const parsed = userUpdateRequestSchema.safeParse(request.body);
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

    const targetId = request.params.id;
    const tenantId = request.user.tenant_id;

    // Fetch target user
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.tenant_id, tenantId)))
      .limit(1);

    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found', details: null },
      });
    }

    // Cannot change own role
    if (parsed.data.role && targetId === request.user.id) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Cannot change your own role', details: null },
      });
    }

    // Cannot change owner's role unless you are the owner
    if (parsed.data.role && target.role === 'owner' && request.user.role !== 'owner') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: "Cannot change the owner's role", details: null },
      });
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.first_name !== undefined) updateData.first_name = parsed.data.first_name;
    if (parsed.data.last_name !== undefined) updateData.last_name = parsed.data.last_name;
    if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, targetId), eq(users.tenant_id, tenantId)))
      .returning();

    return reply.status(200).send({
      success: true,
      data: formatUser(updated),
    });
  });

  // DELETE /api/v1/users/:id  (deactivate)
  app.delete<{ Params: { id: string } }>('/:id', { preHandler }, async (request, reply) => {
    const targetId = request.params.id;
    const tenantId = request.user.tenant_id;

    // Cannot deactivate self
    if (targetId === request.user.id) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Cannot deactivate yourself', details: null },
      });
    }

    // Fetch target user
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.tenant_id, tenantId)))
      .limit(1);

    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found', details: null },
      });
    }

    // Cannot deactivate the owner
    if (target.role === 'owner') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Cannot deactivate the owner', details: null },
      });
    }

    await db
      .update(users)
      .set({ is_active: false, updated_at: new Date() })
      .where(and(eq(users.id, targetId), eq(users.tenant_id, tenantId)));

    return reply.status(200).send({
      success: true,
      data: null,
    });
  });
}
