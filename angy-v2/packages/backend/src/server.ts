import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import crypto from 'node:crypto';
import { authPlugin } from './plugins/auth.js';
import { rateLimiterPlugin } from './plugins/rate-limiter.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { vehicleTokenRoutes } from './routes/vehicle-tokens.js';
import { driverRoutes } from './routes/drivers.js';
import { shipmentRoutes } from './routes/shipments.js';
import { routeRoutes } from './routes/routes.js';
import { geofenceRoutes } from './routes/geofences.js';
import { analyticsRoutes } from './routes/analytics.js';
import { notificationRoutes } from './routes/notifications.js';
import { webhookRoutes } from './routes/webhooks.js';
import { dashboardWs } from './ws/dashboard.js';
import { trackingWs } from './ws/tracking.js';
import { initFanOut } from './ws/fan-out.js';
import { scheduleDrivingHoursReset } from './jobs/driving-hours-reset.job.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  },
  genReqId: () => crypto.randomUUID(),
});

// Request ID in response headers + structured logging context
app.addHook('onRequest', async (request, reply) => {
  reply.header('X-Request-Id', request.id);
  request.log = request.log.child({
    request_id: request.id,
  });
});

// Global error handler
app.setErrorHandler((err: FastifyError, request, reply) => {
  const statusCode = err.statusCode ?? 500;

  request.log.error(
    {
      err,
      tenant_id: (request as any).user?.tenant_id,
      user_id: (request as any).user?.id,
    },
    err.message,
  );

  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  reply.status(statusCode).send({
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message,
      details: err.validation ?? null,
    },
  });
});

async function start() {
  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.register(cookie);
  await app.register(websocket);
  await app.register(authPlugin);
  await app.register(rateLimiterPlugin);

  // Health endpoint
  app.get('/health', async () => ({ status: 'ok' }));

  // API routes
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(vehicleRoutes, { prefix: '/vehicles' });
      await api.register(vehicleTokenRoutes, { prefix: '/vehicles' });
      await api.register(driverRoutes, { prefix: '/drivers' });
      await api.register(shipmentRoutes, { prefix: '/shipments' });
      await api.register(routeRoutes, { prefix: '/routes' });
      await api.register(geofenceRoutes, { prefix: '/geofences' });
      await api.register(analyticsRoutes, { prefix: '/analytics' });
      await api.register(notificationRoutes, { prefix: '/notifications' });
      await api.register(webhookRoutes, { prefix: '/webhooks' });
    },
    { prefix: '/api/v1' },
  );

  // Schedule repeatable cron jobs
  await scheduleDrivingHoursReset();

  // Start Redis pub/sub fan-out before WS routes so it's ready to deliver
  initFanOut();

  // WebSocket routes
  await app.register(
    async (ws) => {
      await ws.register(dashboardWs);
      await ws.register(trackingWs);
    },
    { prefix: '/ws' },
  );

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  app.log.info(`Server listening on ${host}:${port}`);
}

start().catch((err) => {
  app.log.fatal(err);
  process.exit(1);
});

export { app };
