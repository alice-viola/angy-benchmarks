import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    redisSub: Redis;
  }
}

async function redisPlugin(fastify: FastifyInstance) {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  const redis = new Redis(url, { maxRetriesPerRequest: 3 });
  const redisSub = new Redis(url, { maxRetriesPerRequest: 3 });

  redis.on('error', (err) => fastify.log.error(err, 'Redis command client error'));
  redisSub.on('error', (err) => fastify.log.error(err, 'Redis subscriber client error'));

  fastify.decorate('redis', redis);
  fastify.decorate('redisSub', redisSub);

  fastify.addHook('onClose', async () => {
    await redis.quit();
    await redisSub.quit();
  });
}

export default fp(redisPlugin, { name: 'redis' });
