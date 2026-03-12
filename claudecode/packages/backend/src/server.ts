import { readFileSync } from 'fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { redis } from './db/connection.js';
import { authPlugin } from './plugins/auth.js';
import { tenancyPlugin } from './plugins/tenancy.js';
import { authRoutes } from './routes/auth.js';
import { shipmentRoutes } from './routes/shipments.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { driverRoutes } from './routes/drivers.js';
import { routeRoutes } from './routes/routes.js';
import { geofenceRoutes } from './routes/geofences.js';
import { analyticsRoutes } from './routes/analytics.js';
import { webhookRoutes } from './routes/webhooks.js';
import { userRoutes } from './routes/users.js';
import { trackingWsHandler } from './ws/tracking.js';
import { dashboardWsHandler } from './ws/dashboard.js';
import { initializeJobs } from './jobs/index.js';

if (process.env.JWT_PRIVATE_KEY_PATH && !process.env.JWT_PRIVATE_KEY) {
  process.env.JWT_PRIVATE_KEY = readFileSync(process.env.JWT_PRIVATE_KEY_PATH, 'utf-8');
}
if (process.env.JWT_PUBLIC_KEY_PATH && !process.env.JWT_PUBLIC_KEY) {
  process.env.JWT_PUBLIC_KEY = readFileSync(process.env.JWT_PUBLIC_KEY_PATH, 'utf-8');
}

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            requestId: request.id,
            tenantId: (request as any).tenantId,
            userId: (request as any).user?.userId,
          };
        },
      },
    },
    genReqId: () => crypto.randomUUID(),
  });

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await app.register(cors, {
    origin: CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(websocket);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  // Custom plugins
  await app.register(authPlugin);
  await app.register(tenancyPlugin);

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  app.get('/health', { config: { skipAuth: true } }, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ---------------------------------------------------------------------------
  // REST Routes
  // ---------------------------------------------------------------------------

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(shipmentRoutes, { prefix: '/api/v1/shipments' });
  await app.register(vehicleRoutes, { prefix: '/api/v1/vehicles' });
  await app.register(driverRoutes, { prefix: '/api/v1/drivers' });
  await app.register(routeRoutes, { prefix: '/api/v1/routes' });
  await app.register(geofenceRoutes, { prefix: '/api/v1/geofences' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });

  // ---------------------------------------------------------------------------
  // WebSocket Routes
  // ---------------------------------------------------------------------------

  await app.register(trackingWsHandler);
  await app.register(dashboardWsHandler);

  // ---------------------------------------------------------------------------
  // Global error handler
  // ---------------------------------------------------------------------------

  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const logMethod = statusCode >= 500 ? 'error' : 'warn';

    request.log[logMethod]({ err: error, statusCode }, 'Request error');

    if (statusCode >= 500) {
      reply.status(statusCode).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    } else {
      reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code ?? 'ERROR',
          message: error.message,
          details: error.validation ?? undefined,
        },
      });
    }
  });

  return app;
}

async function start() {
  const app = await buildApp();

  // Initialize BullMQ workers
  initializeJobs();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`NexusFleet backend listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
