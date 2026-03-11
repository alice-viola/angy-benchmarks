import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { handler as trackingHandler } from '../ws/tracking.handler.js';
import { handler as dashboardHandler } from '../ws/dashboard.handler.js';

export default fp(
  async (app: FastifyInstance) => {
    await app.register(websocket);
    await app.register(trackingHandler);
    await app.register(dashboardHandler);
  },
  { name: 'websocket-plugin' },
);
