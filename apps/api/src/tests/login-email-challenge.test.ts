import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
  sendEmail: vi.fn(),
}));

vi.mock("@workspace/db", () => ({ db: mocks.db }));
vi.mock("../features/email/email.service", () => ({ sendEmail: mocks.sendEmail }));

import { createLoginEmailChallenge, verifyLoginEmailChallenge } from "../features/profiles/loginEmailChallenge.service";

describe("suspicious login email challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOGIN_CODE_SECRET = "unit-test-login-code-secret";
    mocks.sendEmail.mockResolvedValue({ ok: true, provider: "test" });
    mocks.db.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) });
  });

  it("sends a short-lived code and stores only its keyed hash", async () => {
    let inserted: Record<string, unknown> | undefined;
    mocks.db.insert.mockReturnValue({
      values: (value: Record<string, unknown>) => {
        inserted = value;
        return { returning: async () => [{ id: 17 }] };
      },
    });

    const result = await createLoginEmailChallenge({
      userId: 5,
      authVersion: 2,
      email: "writer@example.com",
      metadata: { ipHash: "ip-hash", userAgent: "browser", country: "US", timezone: "UTC" },
    });

    expect(result).toMatchObject({ challengeId: 17, email: "w****r@example.com", expiresInSeconds: 600 });
    expect(inserted?.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted?.codeHash).not.toBe(mocks.sendEmail.mock.calls[0][0].text.match(/\d{6}/)?.[0]);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "writer@example.com",
      subject: "Your QuillHive sign-in code",
      text: expect.stringMatching(/\d{6}/),
    }));
  });

  it("consumes a valid code exactly once and increments failed attempts", async () => {
    const code = "048219";
    const nonce = "challenge-nonce";
    const challenge = {
      id: 17,
      userId: 5,
      authVersion: 2,
      nonce,
      codeHash: createHmac("sha256", process.env.LOGIN_CODE_SECRET!)
        .update(`5:${nonce}:${code}`)
        .digest("hex"),
      ipHash: "ip-hash",
      userAgent: "browser",
      country: "US",
      timezone: "UTC",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    mocks.db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [challenge] }) }) });
    const consumed = { ...challenge, usedAt: new Date() };
    mocks.db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [consumed] }) }) });

    await expect(verifyLoginEmailChallenge(17, "000000")).resolves.toBeNull();
    expect(mocks.db.update).toHaveBeenCalled();

    mocks.db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [consumed] }) }) });
    await expect(verifyLoginEmailChallenge(17, code)).resolves.toMatchObject({ userId: 5, ipHash: "ip-hash" });

    mocks.db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
    await expect(verifyLoginEmailChallenge(17, code)).resolves.toBeNull();
  });

  it("fails closed and invalidates the challenge if email delivery fails", async () => {
    mocks.db.insert.mockReturnValue({ values: () => ({ returning: async () => [{ id: 18 }] }) });
    mocks.sendEmail.mockResolvedValue({ ok: false, provider: "none", error: "not configured" });

    await expect(createLoginEmailChallenge({
      userId: 5,
      authVersion: 2,
      email: "writer@example.com",
      metadata: { ipHash: "ip-hash", country: null, timezone: null },
    })).rejects.toThrow("We could not send a verification code to your email.");
    expect(mocks.db.update).toHaveBeenCalled();
  });
});
