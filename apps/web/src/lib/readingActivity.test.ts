import { describe, expect, it } from "vitest";
import { getActiveReadingDelta } from "./readingActivity";

describe("getActiveReadingDelta", () => {
  it("counts only visible, focused time within the recent activity window", () => {
    expect(getActiveReadingDelta(20_000, 19_000, 15_000, true, true)).toBe(1_000);
    expect(getActiveReadingDelta(60_000, 59_000, 20_000, true, true)).toBe(0);
    expect(getActiveReadingDelta(20_000, 19_000, 15_000, false, true)).toBe(0);
    expect(getActiveReadingDelta(20_000, 19_000, 15_000, true, false)).toBe(0);
  });
});
