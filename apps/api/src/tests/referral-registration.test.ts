import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));

import { registerSchema } from "../features/profiles/profile.routes";

describe("signup referral fields", () => {
  it("retains invite codes and referral sources after request validation", () => {
    const parsed = registerSchema.parse({
      username: "referral_test",
      email: "referral@example.com",
      password: "strong-password",
      displayName: "Referral Test",
      inviteCode: "AB12CD34",
      ref: "newsletter",
    });

    expect(parsed.inviteCode).toBe("AB12CD34");
    expect(parsed.ref).toBe("newsletter");
  });
});
