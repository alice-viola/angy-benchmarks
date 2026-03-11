import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';
import authPlugin from './plugins/auth.plugin.js';
import tenantPlugin from './plugins/tenant.plugin.js';
import rateLimitPlugin from './plugins/rate-limit.plugin.js';
import websocketPlugin from './plugins/websocket.plugin.js';
import { startWorkers } from './jobs/queue.js';
import authRoutes from './routes/auth.routes.js';
import vehicleRoutes from './routes/vehicles.routes.js';
import driverRoutes from './routes/drivers.routes.js';
import shipmentRoutes from './routes/shipments.routes.js';
import routeRoutes from './routes/routes.routes.js';
import geofenceRoutes from './routes/geofences.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import userRoutes from './routes/users.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  },
  genReqId: () => randomUUID(),
});

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});

await app.register(cookie);

// WebSocket plugin (must be registered before auth hooks that block non-Bearer requests)
await app.register(websocketPlugin);

app.addHook('onRequest', async (request, reply) => {
  reply.header('X-Request-Id', request.id);
});

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Auth & tenant plugins
await app.register(authPlugin);
await app.register(tenantPlugin);
await app.register(rateLimitPlugin);

// Routes
await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(vehicleRoutes, { prefix: '/api/v1/vehicles' });
await app.register(driverRoutes, { prefix: '/api/v1/drivers' });
await app.register(shipmentRoutes, { prefix: '/api/v1/shipments' });
await app.register(routeRoutes, { prefix: '/api/v1/routes' });
await app.register(geofenceRoutes, { prefix: '/api/v1/geofences' });
await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
await app.register(userRoutes, { prefix: '/api/v1/users' });
await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  // Start BullMQ workers after server is listening
  startWorkers()
    .then((workers) => {
      app.log.info(`Started ${workers.length} BullMQ workers`);
    })
    .catch((err) => {
      app.log.error(err, 'Failed to start BullMQ workers');
    });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
