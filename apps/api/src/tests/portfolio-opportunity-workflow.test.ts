import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canAccessOpportunityWorkspace,
  DEFAULT_OPPORTUNITY_LIFETIME_MS,
  decideOpportunityApplication,
  getOpportunityExpiry,
  isOpportunityExpired,
  resolveCompletionAction,
} from "../features/creator-economy/opportunityWorkflow";
import { canViewProfileWithSignals } from "../features/profiles/profileAccessPolicy";

describe("opportunity application workspace policy", () => {
  it("expires opportunities at their configured deadline and gives legacy listings a finite default", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const deadline = new Date("2026-01-05T12:00:00.000Z");
    expect(isOpportunityExpired(deadline, createdAt, new Date("2026-01-05T11:59:59.999Z"))).toBe(false);
    expect(isOpportunityExpired(deadline, createdAt, deadline)).toBe(true);
    expect(getOpportunityExpiry(null, createdAt).getTime()).toBe(createdAt.getTime() + DEFAULT_OPPORTUNITY_LIFETIME_MS);
    expect(isOpportunityExpired(null, createdAt, new Date(createdAt.getTime() + DEFAULT_OPPORTUNITY_LIFETIME_MS))).toBe(true);
  });

  it("only lets the opportunity owner accept or reject a pending application", () => {
    expect(decideOpportunityApplication({
      status: "pending",
      action: "accepted",
      isOwner: true,
      isApplicant: false,
    })).toBe("apply");
    expect(decideOpportunityApplication({
      status: "pending",
      action: "accepted",
      isOwner: false,
      isApplicant: true,
    })).toBe("forbidden");
    expect(decideOpportunityApplication({
      status: "pending",
      action: "rejected",
      isOwner: true,
      isApplicant: false,
    })).toBe("apply");
  });

  it("makes repeated acceptance idempotent and excludes rejected or cancelled applications", () => {
    expect(decideOpportunityApplication({
      status: "accepted",
      action: "accepted",
      isOwner: true,
      isApplicant: false,
    })).toBe("idempotent");
    expect(canAccessOpportunityWorkspace("accepted", true, false)).toBe(true);
    expect(canAccessOpportunityWorkspace("completed", false, true)).toBe(true);
    expect(canAccessOpportunityWorkspace("rejected", true, false)).toBe(false);
    expect(canAccessOpportunityWorkspace("cancelled", false, true)).toBe(false);
  });

  it("requires both participants to confirm completion", () => {
    expect(resolveCompletionAction({
      status: "accepted",
      requestedById: null,
      actorId: 4,
      action: "request",
    })).toBe("request");
    expect(resolveCompletionAction({
      status: "accepted",
      requestedById: 4,
      actorId: 4,
      action: "confirm",
    })).toBe("confirmation_required");
    expect(resolveCompletionAction({
      status: "accepted",
      requestedById: 4,
      actorId: 8,
      action: "confirm",
    })).toBe("complete");
    expect(resolveCompletionAction({
      status: "completed",
      requestedById: 4,
      actorId: 8,
      action: "confirm",
    })).toBe("completed");
  });

  it("allows cancellation only for participants and only before completion", () => {
    expect(decideOpportunityApplication({
      status: "accepted",
      action: "cancelled",
      isOwner: false,
      isApplicant: true,
    })).toBe("apply");
    expect(decideOpportunityApplication({
      status: "completed",
      action: "cancelled",
      isOwner: true,
      isApplicant: false,
    })).toBe("conflict");
    expect(decideOpportunityApplication({
      status: "pending",
      action: "cancelled",
      isOwner: false,
      isApplicant: false,
    })).toBe("forbidden");
  });
});

describe("profile visibility policy", () => {
  const profileUserId = 10;

  it("hides non-public profile data unless the viewer follows, and blocks override public visibility", () => {
    expect(canViewProfileWithSignals({
      profileUserId,
      viewerId: 2,
      profileVisibility: "private",
      isBlocked: false,
      isFollowing: true,
    })).toBe(false);
    expect(canViewProfileWithSignals({
      profileUserId,
      viewerId: 2,
      profileVisibility: "followers",
      isBlocked: false,
      isFollowing: true,
    })).toBe(true);
    expect(canViewProfileWithSignals({
      profileUserId,
      viewerId: 2,
      profileVisibility: "public",
      isBlocked: true,
      isFollowing: false,
    })).toBe(false);
    expect(canViewProfileWithSignals({
      profileUserId,
      viewerId: profileUserId,
      profileVisibility: "private",
      isBlocked: true,
      isFollowing: false,
    })).toBe(true);
  });
});

describe("portfolio and opportunity workspace migration", () => {
  it("records evidence, completion confirmation, and an idempotent application-room link", () => {
    const migration = readFileSync(
      fileURLToPath(new URL("../../../../packages/utils/db/drizzle/0038_verified_portfolios_opportunity_rooms.sql", import.meta.url)),
      "utf8",
    );
    const journal = JSON.parse(readFileSync(
      fileURLToPath(new URL("../../../../packages/utils/db/drizzle/meta/_journal.json", import.meta.url)),
      "utf8",
    )) as { entries: Array<{ tag: string }> };
    expect(migration).toContain('"evidence_url" text');
    expect(migration).toContain('"completion_requested_by_id" integer');
    expect(migration).toContain('"completed_at" timestamp');
    expect(migration).toContain('"opportunity_application_id" integer');
    expect(migration).toContain("collaboration_rooms_opportunity_application_unique");
    expect(journal.entries.some(entry => entry.tag === "0038_verified_portfolios_opportunity_rooms")).toBe(true);
  });

  it("adds a dedicated field for opportunity fee and payment terms", () => {
    const migration = readFileSync(
      fileURLToPath(new URL("../../../../packages/utils/db/drizzle/0043_job_fee_details.sql", import.meta.url)),
      "utf8",
    );
    const journal = JSON.parse(readFileSync(
      fileURLToPath(new URL("../../../../packages/utils/db/drizzle/meta/_journal.json", import.meta.url)),
      "utf8",
    )) as { entries: Array<{ tag: string }> };
    expect(migration).toContain('ADD COLUMN "fee_details" text');
    expect(journal.entries.some(entry => entry.tag === "0043_job_fee_details")).toBe(true);
  });
});
