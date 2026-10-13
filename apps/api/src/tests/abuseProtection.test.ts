import { describe, expect, it, vi } from "vitest";
import { createSession } from "../lib/auth";
import { preventSpam } from "../middleware/abuseProtection";

describe("preventSpam", () => {
  it("allows one immediate duplicate but blocks repeated copies during the short cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    const handler = preventSpam("posts", { max: 10, windowMs: 60_000, duplicateWindowMs: 30_000, duplicateThreshold: 2 });
    const next = vi.fn() as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const baseReq = {
      headers: {},
      body: { content: "same content from a legit user" },
      ip: "203.0.113.10",
    } as any;

    try {
      await handler(baseReq, res, next);
      await handler({ ...baseReq, body: { content: "same content from a legit user" } }, res, next);
      expect(next).toHaveBeenCalledTimes(2);
      await handler({ ...baseReq, body: { content: "same content from a legit user" } }, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: "You already posted this recently. You can repost after 30 seconds." });

      await vi.advanceTimersByTimeAsync(30_001);
      await handler({ ...baseReq, body: { content: "same content from a legit user" } }, res, next);
      expect(next).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows distinct content without triggering the duplicate guard", async () => {
    const handler = preventSpam("posts", { max: 10, windowMs: 60_000 });
    const next = vi.fn() as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const baseReq = {
      headers: {},
      body: { content: "spammy duplicate" },
      ip: "198.51.100.20",
    } as any;

    await handler(baseReq, res, next);
    await handler({ ...baseReq, body: { content: "a distinct post" } }, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("allows high-trust policy to bypass identical-content cooldown", async () => {
    const handler = preventSpam("posts", {
      max: 100,
      resolvePolicy: async () => ({ max: 100, bypassDuplicateCheck: true }),
    });
    const next = vi.fn() as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    const req = { headers: {}, body: { content: "repeated test post" }, ip: "192.0.2.30" } as any;

    await handler(req, res, next);
    await handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("enforces the shared IP cap across different authenticated accounts", async () => {
    const handler = preventSpam("posts", { max: 10, ipMax: 1 });
    const next = vi.fn() as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    const baseReq = { headers: {}, body: { content: "post" }, ip: "192.0.2.40" } as any;

    await handler({ ...baseReq, headers: { authorization: `Bearer ${createSession(101)}` } }, res, next);
    await handler({ ...baseReq, headers: { authorization: `Bearer ${createSession(102)}` } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
