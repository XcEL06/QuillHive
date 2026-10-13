import { describe, expect, it, vi } from "vitest";
import { preventSpam } from "../middleware/abuseProtection";

describe("preventSpam", () => {
  it("allows one retry of the same content without tripping the duplicate guard", () => {
    const handler = preventSpam("posts", { max: 10, windowMs: 60_000, duplicateWindowMs: 120_000 });
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

    handler(baseReq, res, next);
    handler({ ...baseReq, body: { content: "same content from a legit user" } }, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("still blocks repeated exact duplicates after the grace window is exceeded", () => {
    const handler = preventSpam("posts", { max: 10, windowMs: 60_000, duplicateWindowMs: 120_000 });
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

    handler(baseReq, res, next);
    handler({ ...baseReq, body: { content: "spammy duplicate" } }, res, next);
    handler({ ...baseReq, body: { content: "spammy duplicate" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});
