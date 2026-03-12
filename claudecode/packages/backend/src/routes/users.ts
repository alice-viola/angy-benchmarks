import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { userCreateSchema, paginationSchema } from '@nexus-fleet/shared';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List tenant users (owner/admin only)
  // -------------------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const query = request.query as Record<string, string>;

      const pagination = paginationSchema.parse({
        page: query.page,
        pageSize: query.pageSize,
      });

      const offset = (pagination.page - 1) * pagination.pageSize;

      const [items, [totalResult]] = await Promise.all([
        db
          .select({
            id: users.id,
            email: users.email,
            first_name: users.first_name,
            last_name: users.last_name,
            role: users.role,
            is_active: users.is_active,
            last_login_at: users.last_login_at,
            created_at: users.created_at,
          })
          .from(users)
          .where(eq(users.tenant_id, tenantId))
          .orderBy(desc(users.created_at))
          .limit(pagination.pageSize)
          .offset(offset),
        db
          .select({ count: count() })
          .from(users)
          .where(eq(users.tenant_id, tenantId)),
      ]);

      return reply.send({
        success: true,
        data: items,
        meta: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItems: totalResult?.count ?? 0,
          totalPages: Math.ceil((totalResult?.count ?? 0) / pagination.pageSize),
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST / - Create user (owner/admin only)
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = userCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      // Prevent non-owners from creating owner users
      if (parsed.data.role === 'owner' && request.user.role !== 'owner') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only owners can create owner users' },
        });
      }

      // Check email uniqueness within tenant
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenant_id, tenantId), eq(users.email, parsed.data.email)))
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Email already exists in this organization' },
        });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);

      const [user] = await db
        .insert(users)
        .values({
          tenant_id: tenantId,
          email: parsed.data.email,
          password_hash: passwordHash,
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          role: parsed.data.role,
          is_active: true,
        })
        .returning({
          id: users.id,
          email: users.email,
          first_name: users.first_name,
          last_name: users.last_name,
          role: users.role,
          is_active: users.is_active,
          created_at: users.created_at,
        });

      return reply.status(201).send({ success: true, data: user });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /:id - Update user (owner/admin only)
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      // Prevent changing own role
      if (id === request.user.userId && (request.body as any).role !== undefined) {
        return reply.status(422).send({
          success: false,
          error: { code: 'INVALID_OPERATION', message: 'Cannot change your own role' },
        });
      }

      const body = request.body as Record<string, any>;
      const updateData: Record<string, any> = { updated_at: new Date() };

      if (body.email !== undefined) updateData.email = body.email;
      if (body.first_name !== undefined) updateData.first_name = body.first_name;
      if (body.last_name !== undefined) updateData.last_name = body.last_name;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.password !== undefined) {
        updateData.password_hash = await bcrypt.hash(body.password, 12);
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
        .returning({
          id: users.id,
          email: users.email,
          first_name: users.first_name,
          last_name: users.last_name,
          role: users.role,
          is_active: users.is_active,
          created_at: users.created_at,
        });

      return reply.send({ success: true, data: updated });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id - Deactivate user (owner/admin only)
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      // Prevent self-deactivation
      if (id === request.user.userId) {
        return reply.status(422).send({
          success: false,
          error: { code: 'INVALID_OPERATION', message: 'Cannot deactivate your own account' },
        });
      }

      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      await db
        .update(users)
        .set({
          is_active: false,
          refresh_token_hash: null,
          updated_at: new Date(),
        })
        .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)));

      return reply.status(204).send();
    },
  );
};
