import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  rows: [] as Array<{ authVersion?: number; id?: number }>,
  insertedSession: null as Record<string, unknown> | null,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(dbMocks.rows)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((session: Record<string, unknown>) => {
        dbMocks.insertedSession = session;
        return { onConflictDoNothing: vi.fn() };
      }),
    })),
  },
}));
vi.mock("@workspace/db/schema", () => ({
  revokedTokensTable: { id: "id", tokenHash: "tokenHash", expiresAt: "expiresAt" },
  sessionsTable: { id: "id", tokenHash: "tokenHash", userId: "userId", expiresAt: "expiresAt" },
  usersTable: { id: "id", authVersion: "authVersion" },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((...conditions: unknown[]) => conditions),
  gt: vi.fn((...conditions: unknown[]) => conditions),
  lt: vi.fn((...conditions: unknown[]) => conditions),
}));

describe("access token session binding", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "unit-test-session-binding-secret-long-enough";
    dbMocks.rows = [{ authVersion: 3 }];
    dbMocks.insertedSession = null;
  });

  it("binds access to its stored session and rejects it once that row is revoked", async () => {
    const { createAuthTokens, isSessionActive } = await import("../lib/auth");
    const tokens = await createAuthTokens(12);
    expect(dbMocks.insertedSession).toMatchObject({ userId: 12 });
    dbMocks.rows = [{ id: 44 }];
    expect(await isSessionActive(tokens.token, 12)).toBe(true);

    dbMocks.rows = [];
    expect(await isSessionActive(tokens.token, 12)).toBe(false);
  });
});
