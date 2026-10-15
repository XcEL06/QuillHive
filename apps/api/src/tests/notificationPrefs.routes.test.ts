import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: dbMocks.select,
    from: dbMocks.from,
    where: dbMocks.where,
    limit: dbMocks.limit,
  },
}));
vi.mock("@workspace/db/schema", () => ({ usersTable: { id: "id", notificationPrefs: "notificationPrefs" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => "user-id-condition") }));
vi.mock("../middleware/admin", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { currentUser: { id: number } }).currentUser = { id: 42 };
    next();
  },
}));

import { notificationPrefsRouter, DEFAULT_PREFS } from "../features/notifications/notificationPrefs.routes";

describe("notification preferences API", () => {
  let server: ReturnType<typeof createServer> | undefined;
  let origin = "";

  beforeEach(async () => {
    const builder = {
      from: dbMocks.from,
      where: dbMocks.where,
      limit: dbMocks.limit,
    };
    dbMocks.select.mockReturnValue(builder);
    dbMocks.from.mockReturnValue(builder);
    dbMocks.where.mockReturnValue(builder);
    dbMocks.limit.mockResolvedValue([{ notificationPrefs: null }]);

    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationPrefsRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
    vi.clearAllMocks();
  });

  it("returns merged notification preferences for an authenticated user", async () => {
    const saved = { like: { inApp: false, push: true, email: false } };
    dbMocks.limit.mockResolvedValue([{ notificationPrefs: saved }]);

    const response = await fetch(`${origin}/api/notifications/preferences`, {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      preferences: { ...DEFAULT_PREFS, ...saved },
    });
  });

  it("returns defaults when the notification preferences column is missing", async () => {
    dbMocks.limit.mockRejectedValue(Object.assign(new Error('column "notification_prefs" does not exist'), { code: "42703" }));

    const response = await fetch(`${origin}/api/notifications/preferences`, {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ preferences: DEFAULT_PREFS });
  });

  it("does not report a successful save when the notification preferences column is missing", async () => {
    dbMocks.limit.mockRejectedValue(Object.assign(new Error('column "notification_prefs" does not exist'), { code: "42703" }));

    const response = await fetch(`${origin}/api/notifications/preferences`, {
      method: "PATCH",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ like: { inApp: false, push: false, email: false } }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "notification_preferences_unavailable",
      message: "Notification preferences cannot be saved until the database schema is updated.",
    });
  });
});
