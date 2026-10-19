import { describe, expect, it } from "vitest";
import { getAccountBanStatus, temporaryRestrictionResponse } from "../lib/accountRestriction";

describe("account restrictions", () => {
  const now = new Date("2026-10-19T08:00:00.000Z");

  it("distinguishes active temporary restrictions from permanent bans", () => {
    const until = new Date(now.getTime() + 86_400_000);
    expect(getAccountBanStatus(true, until, "Repeated harassment", now)).toEqual({
      kind: "temporary",
      until,
      reason: "Repeated harassment",
    });
    expect(getAccountBanStatus(true, null, "Repeated harassment", now)).toEqual({
      kind: "permanent",
      reason: "Repeated harassment",
    });
  });

  it("expires restrictions at their expiry instant and ignores inactive ban fields", () => {
    expect(getAccountBanStatus(true, now, null, now)).toEqual({ kind: "expired" });
    expect(getAccountBanStatus(false, new Date(now.getTime() + 1), null, now)).toEqual({ kind: "none" });
  });

  it("returns a clear restriction response with expiry and reason", () => {
    const until = new Date(now.getTime() + 86_400_000);
    expect(temporaryRestrictionResponse(until, "Repeated harassment")).toEqual({
      error: "Account temporarily restricted",
      code: "TEMPORARY_RESTRICTION",
      until: until.toISOString(),
      reason: "Repeated harassment",
    });
  });
});
