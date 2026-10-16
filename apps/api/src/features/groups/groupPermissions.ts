export type GroupRole = "member" | "moderator" | "admin" | "owner";

const ROLE_LEVEL: Record<GroupRole, number> = {
  member: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

export function canManageGroupSettings(role: GroupRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canManageOwnerSettings(role: GroupRole | null): boolean {
  return role === "owner";
}

export function canManageMemberRole(
  actorRole: GroupRole | null,
  targetRole: GroupRole,
  requestedRole: Exclude<GroupRole, "owner">,
): boolean {
  if (targetRole === "owner" || !actorRole) return false;
  if (actorRole === "owner") return true;
  if (actorRole !== "admin") return false;
  return ROLE_LEVEL[targetRole] < ROLE_LEVEL.admin && ROLE_LEVEL[requestedRole] < ROLE_LEVEL.admin;
}

export function canRestrictGroupMember(actorRole: GroupRole | null, targetRole: GroupRole): boolean {
  if (!actorRole || targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "member" || targetRole === "moderator";
  return actorRole === "moderator" && targetRole === "member";
}

export type ReputationStatus = "not_required" | "meets" | "below" | "missing" | "stale" | "disputed";

export function evaluateGroupReputation(input: {
  threshold: number | null;
  score: number | null;
  updatedAt: Date | null;
  isDisputed: boolean;
  now?: Date;
  maxAgeMs?: number;
}): ReputationStatus {
  const { threshold, score, updatedAt, isDisputed } = input;
  if (threshold === null) return "not_required";
  if (isDisputed) return "disputed";
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return "missing";
  if (!updatedAt) return "missing";
  const now = input.now ?? new Date();
  const maxAgeMs = input.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
  if (updatedAt.getTime() > now.getTime() || now.getTime() - updatedAt.getTime() > maxAgeMs) return "stale";
  return score >= threshold ? "meets" : "below";
}

export function reputationReviewReason(status: ReputationStatus): string | null {
  if (status === "missing" || status === "stale" || status === "disputed") return `reputation_${status}`;
  if (status === "below") return "reputation_below_threshold";
  return null;
}

export function meetsGroupReputationThreshold(
  threshold: number | null,
  status: ReputationStatus,
  score: number | null,
): boolean {
  if (threshold === null) return true;
  return (status === "meets" || status === "below") && score !== null && score >= threshold;
}

export function requiresManualJoinReview(
  threshold: number | null,
  status: ReputationStatus,
  score: number | null,
): boolean {
  return threshold !== null && !meetsGroupReputationThreshold(threshold, status, score);
}

export function evaluateGroupPostReview(input: {
  requireApprovalAll: boolean;
  requireApprovalFirstThree: boolean;
  authorPostCount: number;
  minPostReputation: number | null;
  minReviewBypassReputation: number | null;
  reputationStatus: ReputationStatus;
  reputationScore: number | null;
}): { needsApproval: boolean; approvalReason: string | null } {
  const canBypassManualReview = meetsGroupReputationThreshold(
    input.minReviewBypassReputation,
    input.reputationStatus,
    input.reputationScore,
  );
  const meetsPostReputation = meetsGroupReputationThreshold(
    input.minPostReputation,
    input.reputationStatus,
    input.reputationScore,
  );
  const needsApproval = input.requireApprovalAll
    || (input.requireApprovalFirstThree && input.authorPostCount < 3 && !canBypassManualReview)
    || !canBypassManualReview
    || !meetsPostReputation;
  const approvalReason = needsApproval
    ? reputationReviewReason(input.reputationStatus) ?? (!canBypassManualReview ? "reputation_review_required" : null)
    : null;
  return { needsApproval, approvalReason };
}
