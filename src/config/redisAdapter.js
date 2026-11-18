import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

export async function attachRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[REDIS] REDIS_URL not set — running with single-node in-memory adapter.');
    return;
  }

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('[REDIS PUB ERROR]', err.message));
    subClient.on('error', (err) => console.error('[REDIS SUB ERROR]', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[REDIS] Pub/Sub adapter attached — multi-instance broadcasting active.');
  } catch (err) {
    console.error('[REDIS] Connection failed, falling back to in-memory adapter:', err.message);
  }
}