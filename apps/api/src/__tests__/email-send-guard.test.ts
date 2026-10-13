import { afterEach, describe, expect, it, vi } from "vitest";
import { getWeeklyDigestIntervalMs } from "../features/email/emailSendGuard";
import { weeklyCreatorDigestEmailHtml } from "../features/email/email.templates";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("weekly digest email guard", () => {
  it("defaults to a seven-day interval", () => {
    vi.stubEnv("WEEKLY_DIGEST_INTERVAL_DAYS", undefined);
    expect(getWeeklyDigestIntervalMs()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("accepts a configured weekly interval but never less than one day", () => {
    vi.stubEnv("WEEKLY_DIGEST_INTERVAL_DAYS", "10");
    expect(getWeeklyDigestIntervalMs()).toBe(10 * 24 * 60 * 60 * 1000);

    vi.stubEnv("WEEKLY_DIGEST_INTERVAL_DAYS", "0.5");
    expect(getWeeklyDigestIntervalMs).toThrow("WEEKLY_DIGEST_INTERVAL_DAYS");
  });

  it("renders digest highlights with working settings and unsubscribe links", () => {
    const html = weeklyCreatorDigestEmailHtml({
      displayName: "A & B",
      totalViews: 123,
      newFollowers: 4,
      postsPublished: 2,
      topPost: { title: "A <great> post", views: 88 },
      appUrl: "https://quillhive.app",
      unsubscribeUrl: "https://quillhive.app/api/email/unsubscribe?token=123.signature",
    });

    expect(html).toContain("A &amp; B");
    expect(html).toContain("A &lt;great&gt; post");
    expect(html).toContain("123");
    expect(html).toContain("href=\"https://quillhive.app/settings\"");
    expect(html).toContain("href=\"https://quillhive.app/api/email/unsubscribe?token=123.signature\"");
    expect(html).toContain("The QuillHive team");
    expect(html).not.toContain("se ttings");
  });
});
