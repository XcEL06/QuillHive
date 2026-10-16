import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { userTrustScoresTable, usersTable } from "@workspace/db/schema";
import { evaluateGroupReputation, reputationReviewReason, type ReputationStatus } from "./groupPermissions";

export async function assessGroupReputation(userId: number, threshold: number | null): Promise<{
  score: number | null;
  status: ReputationStatus;
  reviewReason: string | null;
}> {
  if (threshold === null) return { score: null, status: "not_required", reviewReason: null };

  const [account] = await db.select({
    score: userTrustScoresTable.uti,
    updatedAt: userTrustScoresTable.updatedAt,
    isDisputed: userTrustScoresTable.isDisputed,
    role: usersTable.role,
    isOfficialAccount: usersTable.isOfficialAccount,
  }).from(usersTable)
    .leftJoin(userTrustScoresTable, eq(userTrustScoresTable.userId, usersTable.id))
    .where(eq(usersTable.id, userId));

  const platformTrusted = account?.role === "super_admin" || account?.isOfficialAccount === true;
  const score = platformTrusted ? 100 : account?.score ?? null;
  const status = platformTrusted
    ? threshold <= 100 ? "meets" : "below"
    : evaluateGroupReputation({
      threshold,
      score,
      updatedAt: account?.updatedAt ?? null,
      isDisputed: account?.isDisputed ?? false,
    });

  return { score, status, reviewReason: reputationReviewReason(status) };
}

export async function readTrustScoreAtJoin(userId: number): Promise<number | null> {
  const [score] = await db.select({ uti: userTrustScoresTable.uti })
    .from(userTrustScoresTable)
    .where(and(eq(userTrustScoresTable.userId, userId), eq(userTrustScoresTable.isDisputed, false)));
  return score?.uti ?? null;
}

export function groupReputationDeniedMessage(status: ReputationStatus, threshold: number): string {
  if (status === "stale") return `Your platform reputation is out of date. Refresh your trust score or request manager review; this group requires ${threshold} reputation.`;
  if (status === "disputed") return "Your platform reputation is under review. Ask a group manager for manual review before commenting.";
  if (status === "missing") return "Your platform reputation is not available yet. Ask a group manager for manual review before commenting.";
  return `This group requires at least ${threshold} platform reputation to comment.`;
}
