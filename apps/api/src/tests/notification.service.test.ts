import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, type: "like", message: "test", category: "social" }]),
  },
}));
vi.mock("@workspace/db/schema", () => ({
  notificationsTable: {},
  usersTable: {},
}));
vi.mock("../lib/socket", () => ({
  emitToUser: vi.fn(),
}));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../features/notifications/push.service", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

describe("notify() - service is importable", () => {
  it("exports notify function", async () => {
    const mod = await import("../features/notifications/notification.service");
    expect(typeof mod.notify).toBe("function");
  });
});

describe("notify() - self-notification guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips notification when userId === actorId", async () => {
    const { notify } = await import("../features/notifications/notification.service");
    const { emitToUser } = await import("../lib/socket");
    const { sendPushToUser } = await import("../features/notifications/push.service");

    await notify({ userId: 42, actorId: 42, type: "like", message: "liked your post" });
    expect(emitToUser).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});

describe("notify() - deduplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not insert when userId === actorId", async () => {
    const { notify } = await import("../features/notifications/notification.service");
    const dbMod = await import("@workspace/db");
    const mockDb = dbMod.db as unknown as { insert: ReturnType<typeof vi.fn> };

    await notify({ userId: 5, actorId: 5, type: "like", message: "liked", postId: 10 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe("official notices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks official_notice through the generic notification helper", async () => {
    const { notify } = await import("../features/notifications/notification.service");
    const dbMod = await import("@workspace/db");
    const mockDb = dbMod.db as unknown as { insert: ReturnType<typeof vi.fn> };

    await notify({
      userId: 9,
      type: "official_notice",
      message: "spoofed",
    } as never);

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates official notices only through the dedicated helper", async () => {
    const { notifyOfficialNotice } = await import("../features/notifications/notification.service");
    const dbMod = await import("@workspace/db");
    const mockDb = dbMod.db as unknown as {
      values: ReturnType<typeof vi.fn>;
      returning: ReturnType<typeof vi.fn>;
    };
    mockDb.returning.mockResolvedValueOnce([
      { id: 3, type: "official_notice", message: "verified staff message" },
    ]);

    await notifyOfficialNotice({
      userId: 9,
      message: "verified staff message",
    });

    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ type: "official_notice" }));
    const { emitToUser } = await import("../lib/socket");
    expect(emitToUser).toHaveBeenCalledWith(
      9,
      "notification:new",
      expect.objectContaining({ type: "official_notice", message: "verified staff message" }),
    );
  });
});
