import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
} from '@nexus-fleet/shared';

const SALT_ROUNDS = 12;

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    const { role } = request.user!;
    if (role !== 'owner' && role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only owner or admin can manage users' },
      });
    }
  });

  // GET / – list tenant users
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { page, limit } = paginationSchema.parse(request.query);
    const offset = (page - 1) * limit;

    const where = eq(users.tenantId, tenantId);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(users).where(where),
    ]);

    return reply.send({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  });

  // POST / – create user
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createUserSchema.parse(request.body);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, body.email)));

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists' },
      });
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({
        tenantId,
        email: body.email,
        passwordHash,
        name: body.name,
        role: body.role,
      })
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return reply.status(201).send({ success: true, data: user });
  });

  // PUT /:id – update user
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId, userId: currentUserId, role: currentRole } = request.user!;
    const { id } = request.params;
    const body = updateUserSchema.parse(request.body);

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Only owners can change roles to/from owner
    if (body.role === 'owner' && currentRole !== 'owner') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only owners can grant owner role' },
      });
    }
    if (existing.role === 'owner' && currentRole !== 'owner') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only owners can modify other owners' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) updateValues.name = body.name;
    if (body.role) updateValues.role = body.role;

    const [updated] = await db
      .update(users)
      .set(updateValues)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – deactivate user
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId, userId: currentUserId } = request.user!;
    const { id } = request.params;

    if (id === currentUserId) {
      return reply.status(409).send({
        success: false,
        error: { code: 'SELF_DEACTIVATION', message: 'Cannot deactivate your own account' },
      });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return reply.send({ success: true, data: updated });
  });
}
