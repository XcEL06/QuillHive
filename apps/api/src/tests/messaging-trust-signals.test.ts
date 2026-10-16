import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
  },
}));

vi.mock("@workspace/db", () => ({ db: mockDb }));
vi.mock("@workspace/db/schema", () => ({ reputationEventsTable: {} }));

describe("message request policy", () => {
  it("requires a request unless the recipient allows anyone or follows the sender", async () => {
    const { shouldRequireMessageRequest } = await import("../features/messaging/messaging.service");
    expect(shouldRequireMessageRequest(false, false)).toBe(true);
    expect(shouldRequireMessageRequest(true, false)).toBe(false);
    expect(shouldRequireMessageRequest(false, true)).toBe(false);
  }, 15000);
});

describe("reputation event idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.onConflictDoNothing.mockResolvedValue(undefined);
  });

  it("stores a stable source key and relies on the unique constraint to ignore retries", async () => {
    const { addReputationEvent } = await import("../features/trust/reputation.service");
    await addReputationEvent(12, "comment_added", "Comment received", undefined, "comment:91:recipient");

    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      userId: 12,
      type: "comment_added",
      eventKey: "comment:91:recipient",
    }));
    expect(mockDb.onConflictDoNothing).toHaveBeenCalledOnce();
  });
});
