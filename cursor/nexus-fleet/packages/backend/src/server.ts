import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';

import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import shipmentRoutes from './routes/shipments.js';
import vehicleRoutes from './routes/vehicles.js';
import driverRoutes from './routes/drivers.js';
import routeRoutes from './routes/routes.js';
import geofenceRoutes from './routes/geofences.js';
import analyticsRoutes from './routes/analytics.js';
import webhookRoutes from './routes/webhooks.js';
import userRoutes from './routes/users.js';

import trackingWs from './ws/tracking.js';
import dashboardWs from './ws/dashboard.js';

import { startWorkers, registerRepeatableJobs } from './jobs/index.js';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(process.env.NODE_ENV !== 'production'
        ? { transport: { target: 'pino-pretty' } }
        : {}),
    },
    genReqId: (req) =>
      (req.headers['x-request-id'] as string) || randomUUID(),
  });

  server.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  await server.register(websocket);

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Plugins: redis → auth → tenant
  await server.register(redisPlugin);
  await server.register(authPlugin);
  await server.register(tenantPlugin);

  // Routes
  await server.register(healthRoutes);
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(shipmentRoutes, { prefix: '/api/v1/shipments' });
  await server.register(vehicleRoutes, { prefix: '/api/v1/vehicles' });
  await server.register(driverRoutes, { prefix: '/api/v1/drivers' });
  await server.register(routeRoutes, { prefix: '/api/v1/routes' });
  await server.register(geofenceRoutes, { prefix: '/api/v1/geofences' });
  await server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await server.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await server.register(userRoutes, { prefix: '/api/v1/users' });

  // WebSocket routes
  await server.register(trackingWs, { prefix: '/ws/tracking' });
  await server.register(dashboardWs, { prefix: '/ws/dashboard' });

  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const isProd = process.env.NODE_ENV === 'production';

    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_SERVER_ERROR',
        message:
          isProd && statusCode >= 500
            ? 'Internal Server Error'
            : error.message,
        ...(isProd ? {} : { details: error.stack }),
      },
    });
  });

  return server;
}

async function start() {
  const server = await buildServer();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  const workers = startWorkers();
  await registerRepeatableJobs();
  server.log.info('BullMQ workers started and repeatable jobs registered');

  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.fatal(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully`);
    await Promise.all(workers.map((w) => w.close()));
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
