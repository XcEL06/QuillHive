import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({
  client: null as {
    get: () => Promise<unknown>;
    setex: () => Promise<unknown>;
    del: () => Promise<unknown>;
    keys: () => Promise<string[]>;
  } | null,
}));
const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("../lib/redis", () => ({ getRedis: () => redisState.client }));
vi.mock("../lib/logger", () => ({ logger: { warn: loggerMocks.warn } }));

describe("Redis cache fallback", () => {
  beforeEach(() => {
    redisState.client = null;
    loggerMocks.warn.mockClear();
  });

  it("continues as a cache miss when Redis is not configured", async () => {
    const { getCache, getCacheMetrics, setCache } = await import("../lib/cache");
    const before = getCacheMetrics();
    expect(await getCache("public-feed")).toBeNull();
    await expect(setCache("public-feed", { posts: [] }, 30)).resolves.toBeUndefined();
    const after = getCacheMetrics();
    expect(after.misses - before.misses).toBe(1);
    expect(after.redisUnavailable - before.redisUnavailable).toBe(2);
  });

  it("falls back to the database path when Redis reads or writes fail", async () => {
    redisState.client = {
      get: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
      setex: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
      del: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
    };
    const { getCache, getCacheMetrics, setCache } = await import("../lib/cache");
    const before = getCacheMetrics();
    expect(await getCache("public-feed")).toBeNull();
    await expect(setCache("public-feed", { posts: [] }, 30)).resolves.toBeUndefined();
    expect(loggerMocks.warn).toHaveBeenCalledTimes(2);
    const after = getCacheMetrics();
    expect(after.readErrors - before.readErrors).toBe(1);
    expect(after.writeErrors - before.writeErrors).toBe(1);
  });

  it("tracks a Redis cache hit and still treats the cached response as a JSON value", async () => {
    redisState.client = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ posts: [{ id: 3 }] })),
      setex: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
    };
    const { getCache, getCacheMetrics } = await import("../lib/cache");
    const before = getCacheMetrics();
    await expect(getCache("feed:viewer:1")).resolves.toEqual({ posts: [{ id: 3 }] });
    const after = getCacheMetrics();
    expect(after.hits - before.hits).toBe(1);
    expect(after.hitRate).toBeGreaterThan(0);
  });

  it("invalidates matching cache entries when a dependent public response changes", async () => {
    const keys = vi.fn().mockResolvedValue(["feed:anon:algorithmic:1", "feed:anon:chronological:1"]);
    const del = vi.fn().mockResolvedValue(2);
    redisState.client = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue("OK"),
      del,
      keys,
    };
    const { deleteCachePattern } = await import("../lib/cache");
    await deleteCachePattern("feed:*");
    expect(keys).toHaveBeenCalledWith("feed:*");
    expect(del).toHaveBeenCalledWith("feed:anon:algorithmic:1", "feed:anon:chronological:1");
  });
});
