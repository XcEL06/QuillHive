import { getRedis } from "./redis";
import { logger } from "./logger";

const cacheMetrics = {
  hits: 0,
  misses: 0,
  redisUnavailable: 0,
  readErrors: 0,
  writeErrors: 0,
  deleteErrors: 0,
};

export function getCacheMetrics() {
  const lookups = cacheMetrics.hits + cacheMetrics.misses;
  return {
    ...cacheMetrics,
    hitRate: lookups === 0 ? 0 : Number((cacheMetrics.hits / lookups).toFixed(4)),
  };
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) {
    cacheMetrics.misses++;
    cacheMetrics.redisUnavailable++;
    return null;
  }
  try {
    const raw = await client.get(key);
    if (raw === null || raw === undefined) {
      cacheMetrics.misses++;
      return null;
    }
    // Upstash REST client may auto-deserialize JSON, returning a plain object.
    // Only call JSON.parse if it's actually a string.
    if (typeof raw === "string") {
      const value = JSON.parse(raw) as T;
      cacheMetrics.hits++;
      return value;
    }
    cacheMetrics.hits++;
    return raw as T;
  } catch (err) {
    cacheMetrics.readErrors++;
    cacheMetrics.misses++;
    logger.warn({ err, key }, "Cache get failed");
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) {
    cacheMetrics.redisUnavailable++;
    return;
  }
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    cacheMetrics.writeErrors++;
    logger.warn({ err, key }, "Cache set failed");
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    cacheMetrics.redisUnavailable++;
    return;
  }
  try {
    await client.del(key);
  } catch (err) {
    cacheMetrics.deleteErrors++;
    logger.warn({ err, key }, "Cache delete failed");
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    cacheMetrics.redisUnavailable++;
    return;
  }
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (err) {
    cacheMetrics.deleteErrors++;
    logger.warn({ err, pattern }, "Cache pattern delete failed");
  }
}
