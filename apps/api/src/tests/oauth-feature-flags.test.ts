import { describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(() => ({ from: vi.fn().mockResolvedValue([]) })),
}));

vi.mock("@workspace/db", () => ({ db: mockDb }));

import { getAllFeatureFlags } from "../lib/featureFlags";

describe("social sign-in feature flags", () => {
  it("keeps Google and GitHub sign-in off until a super admin enables them", async () => {
    const flags = await getAllFeatureFlags();
    expect(flags.google_oauth_enabled).toBe(false);
    expect(flags.github_oauth_enabled).toBe(false);
  });
});
