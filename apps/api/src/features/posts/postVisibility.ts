import { and, eq, ne, or, sql } from "drizzle-orm";
import { postsTable } from "@workspace/db/schema";

export type SparkVisibility = "public" | "followers" | "private";

export function postVisibilityCondition(viewerId: number | null) {
  const visibleToViewer = [eq(postsTable.visibility, "public")];

  if (viewerId !== null) {
    visibleToViewer.push(
      and(eq(postsTable.visibility, "private"), eq(postsTable.authorId, viewerId))!,
      and(
        eq(postsTable.visibility, "followers"),
        sql`EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = ${viewerId}
            AND follows.following_id = ${postsTable.authorId}
        )`,
      )!,
    );
  }

  return or(
    ne(postsTable.type, "spark"),
    and(eq(postsTable.type, "spark"), or(...visibleToViewer)!),
  )!;
}