import { db } from "@workspace/db";
import { reputationEventsTable } from "@workspace/db/schema";
import { eq, desc, sum } from "drizzle-orm";

export type ReputationEventType =
  | "post_like"
  | "comment_added"
  | "report_received"
  | "collaboration_success"
  | "post_shared"
  | "post_saved"
  | "follow_received"
  | "milestone";

const SCORE_MAP: Record<ReputationEventType, number> = {
  post_like: 1,
  comment_added: 2,
  report_received: -5,
  collaboration_success: 10,
  post_shared: 3,
  post_saved: 2,
  follow_received: 3,
  milestone: 15,
};

export async function addReputationEvent(
  userId: number,
  type: ReputationEventType,
  reason: string,
  customScore?: number,
  eventKey?: string,
): Promise<void> {
  const scoreChange = customScore ?? SCORE_MAP[type] ?? 0;
  await db.insert(reputationEventsTable).values({
    userId,
    type,
    scoreChange,
    reason,
    ...(eventKey ? { eventKey } : {}),
  }).onConflictDoNothing();
}

export async function getUserReputationTimeline(userId: number) {
  const events = await db
    .select()
    .from(reputationEventsTable)
    .where(eq(reputationEventsTable.userId, userId))
    .orderBy(desc(reputationEventsTable.createdAt))
    .limit(100);

  const totalResult = await db
    .select({ total: sum(reputationEventsTable.scoreChange) })
    .from(reputationEventsTable)
    .where(eq(reputationEventsTable.userId, userId));

  const totalScoreChange = Number(totalResult[0]?.total ?? 0);

  return { events, totalScoreChange };
}
