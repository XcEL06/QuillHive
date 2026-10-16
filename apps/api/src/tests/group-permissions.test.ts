import { describe, expect, it } from "vitest";
import {
  canManageGroupSettings,
  canManageMemberRole,
  canManageOwnerSettings,
  canRestrictGroupMember,
  evaluateGroupPostReview,
  evaluateGroupReputation,
  meetsGroupReputationThreshold,
  requiresManualJoinReview,
  reputationReviewReason,
} from "../features/groups/groupPermissions";

const current = new Date("2026-10-16T00:00:00.000Z");

describe("group role boundaries", () => {
  it("allows admins to change configuration while reserving ownership settings for owners", () => {
    expect(canManageGroupSettings("admin")).toBe(true);
    expect(canManageGroupSettings("moderator")).toBe(false);
    expect(canManageOwnerSettings("owner")).toBe(true);
    expect(canManageOwnerSettings("admin")).toBe(false);
  });

  it("prevents administrators from promoting members to admin or altering administrators", () => {
    expect(canManageMemberRole("admin", "member", "moderator")).toBe(true);
    expect(canManageMemberRole("admin", "moderator", "member")).toBe(true);
    expect(canManageMemberRole("admin", "member", "admin")).toBe(false);
    expect(canManageMemberRole("admin", "admin", "member")).toBe(false);
    expect(canManageMemberRole("moderator", "member", "moderator")).toBe(false);
    expect(canManageMemberRole("owner", "admin", "moderator")).toBe(true);
    expect(canManageMemberRole("owner", "owner", "member")).toBe(false);
  });

  it("limits moderation restrictions by role hierarchy", () => {
    expect(canRestrictGroupMember("moderator", "member")).toBe(true);
    expect(canRestrictGroupMember("moderator", "moderator")).toBe(false);
    expect(canRestrictGroupMember("admin", "moderator")).toBe(true);
    expect(canRestrictGroupMember("admin", "admin")).toBe(false);
    expect(canRestrictGroupMember("owner", "admin")).toBe(true);
    expect(canRestrictGroupMember("owner", "owner")).toBe(false);
  });
});

describe("group reputation gate evaluation", () => {
  it("accepts a fresh reputation score at or above the threshold", () => {
    expect(evaluateGroupReputation({
      threshold: 50,
      score: 50,
      updatedAt: current,
      isDisputed: false,
      now: current,
    })).toBe("meets");
  });

  it.each([
    [null, current, false, "missing"],
    [70, new Date("2026-08-01T00:00:00.000Z"), false, "stale"],
    [70, current, true, "disputed"],
    [20, current, false, "below"],
  ] as const)("routes non-qualifying or uncertain reputation to review", (score, updatedAt, isDisputed, expected) => {
    const status = evaluateGroupReputation({
      threshold: 50,
      score,
      updatedAt,
      isDisputed,
      now: current,
    });
    expect(status).toBe(expected);
    expect(reputationReviewReason(status)).toBeTruthy();
  });

  it("does not gate groups with no configured threshold", () => {
    expect(evaluateGroupReputation({
      threshold: null,
      score: null,
      updatedAt: null,
      isDisputed: false,
      now: current,
    })).toBe("not_required");
  });

  it("routes new or unverified users to review without letting them bypass the configured gate", () => {
    expect(requiresManualJoinReview(40, "missing", null)).toBe(true);
    expect(requiresManualJoinReview(40, "stale", 90)).toBe(true);
    expect(requiresManualJoinReview(40, "disputed", 90)).toBe(true);
    expect(requiresManualJoinReview(40, "below", 25)).toBe(true);
    expect(requiresManualJoinReview(40, "meets", 40)).toBe(false);
    expect(meetsGroupReputationThreshold(60, "below", 55)).toBe(false);
    expect(meetsGroupReputationThreshold(60, "meets", 60)).toBe(true);
    expect(meetsGroupReputationThreshold(null, "missing", null)).toBe(true);
  });

  it("applies post thresholds and manual-review bypass rules consistently", () => {
    expect(evaluateGroupPostReview({
      requireApprovalAll: false,
      requireApprovalFirstThree: false,
      authorPostCount: 4,
      minPostReputation: 40,
      minReviewBypassReputation: 70,
      reputationStatus: "below",
      reputationScore: 55,
    })).toEqual({ needsApproval: true, approvalReason: "reputation_below_threshold" });

    expect(evaluateGroupPostReview({
      requireApprovalAll: false,
      requireApprovalFirstThree: true,
      authorPostCount: 0,
      minPostReputation: 40,
      minReviewBypassReputation: 70,
      reputationStatus: "meets",
      reputationScore: 80,
    })).toEqual({ needsApproval: false, approvalReason: null });

    expect(evaluateGroupPostReview({
      requireApprovalAll: true,
      requireApprovalFirstThree: false,
      authorPostCount: 20,
      minPostReputation: null,
      minReviewBypassReputation: 70,
      reputationStatus: "meets",
      reputationScore: 80,
    })).toEqual({ needsApproval: true, approvalReason: null });
  });
});
