import { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/rbac.js';
import { generateVehicleToken, revokeVehicleToken } from '../services/vehicle.service.js';

export async function vehicleTokenRoutes(app: FastifyInstance) {
  const preHandler = requireRole('owner', 'admin');

  // POST /api/v1/vehicles/:id/tokens
  app.post<{ Params: { id: string } }>(
    '/:id/tokens',
    { preHandler },
    async (request, reply) => {
      const result = await generateVehicleToken(request.params.id, request.user.tenant_id);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: null },
        });
      }

      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  // DELETE /api/v1/vehicles/:id/tokens
  app.delete<{ Params: { id: string } }>(
    '/:id/tokens',
    { preHandler },
    async (request, reply) => {
      const found = await revokeVehicleToken(request.params.id, request.user.tenant_id);

      if (!found) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: null },
        });
      }

      return { success: true, data: null };
    },
  );
}
