import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDatabase = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@workspace/db", () => ({ db: mockDatabase }));

import { seedOfficialAccount } from "../scripts/seed";
import { assertOfficialSystemAccount } from "../lib/officialSystemAccount";

describe("official account password guard", () => {
  const humanAdmin = {
    id: 42,
    username: "careerevive",
    email: "careerevive@gmail.com",
    role: "super_admin",
    isOfficialAccount: false,
    passwordHash: "human-password-hash",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a super_admin who is not the official system account", () => {
    expect(() => assertOfficialSystemAccount(humanAdmin)).toThrow(
      "Refusing to disable password login for a non-system account.",
    );
    expect(humanAdmin.passwordHash).toBe("human-password-hash");
  });

  it("leaves a human super_admin hash untouched when the seed runs", async () => {
    const queryResults: unknown[][] = [[humanAdmin]];
    mockDatabase.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => queryResults.shift() ?? [],
        }),
      }),
    }));
    const values = vi.fn();
    const onConflictDoNothing = vi.fn(() => ({ returning: vi.fn() }));
    values.mockReturnValue({ onConflictDoNothing });
    mockDatabase.insert.mockReturnValue({ values });

    await expect(seedOfficialAccount(mockDatabase as never)).rejects.toThrow(
      "Refusing to disable password login for a non-system account.",
    );

    expect(mockDatabase.update).not.toHaveBeenCalled();
    expect(mockDatabase.insert).not.toHaveBeenCalled();
    expect(humanAdmin.passwordHash).toBe("human-password-hash");
    expect(values).not.toHaveBeenCalled();
  });
});
