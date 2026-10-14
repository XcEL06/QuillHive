import { and, eq, ne, or, sql } from "drizzle-orm";
import { postsTable } from "@workspace/db/schema";

export type SparkVisibility = "public" | "followers" | "private";

export function postVisibilityCondition(viewerId: number | null, isSuperAdmin = false) {
  if (isSuperAdmin) return sql`TRUE`;

  const visibleToViewer = [eq(postsTable.visibility, "public")];

  if (viewerId !== null) {
    visibleToViewer.push(
      eq(postsTable.authorId, viewerId),
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

  const postTypeVisibility = or(
    ne(postsTable.type, "spark"),
    and(eq(postsTable.type, "spark"), or(...visibleToViewer)!),
  )!;
  const groupVisibility = viewerId === null
    ? sql`(
        ${postsTable.groupId} IS NULL OR EXISTS (
          SELECT 1 FROM groups visibility_group
          WHERE visibility_group.id = ${postsTable.groupId}
            AND visibility_group.is_deleted = false
            AND visibility_group.privacy <> 'private'
        )
      )`
    : sql`(
        ${postsTable.groupId} IS NULL OR EXISTS (
          SELECT 1 FROM groups visibility_group
          WHERE visibility_group.id = ${postsTable.groupId}
            AND visibility_group.is_deleted = false
            AND (
              visibility_group.privacy <> 'private' OR EXISTS (
                SELECT 1 FROM group_members visibility_member
                WHERE visibility_member.group_id = visibility_group.id
                  AND visibility_member.user_id = ${viewerId}
                  AND visibility_member.status IN ('active', 'muted')
              )
            )
        )
      )`;
  const authorAudienceVisibility = viewerId === null
    ? sql`EXISTS (
        SELECT 1 FROM users audience_author
        WHERE audience_author.id = ${postsTable.authorId}
          AND audience_author.profile_visibility = 'public'
          AND audience_author.show_posts_to_everyone = true
      )`
    : sql`EXISTS (
        SELECT 1 FROM users audience_author
        WHERE audience_author.id = ${postsTable.authorId}
          AND (
            audience_author.id = ${viewerId}
            OR (
              audience_author.profile_visibility = 'public'
              AND audience_author.show_posts_to_everyone = true
            )
            OR (
              audience_author.profile_visibility <> 'private'
              AND EXISTS (
                SELECT 1 FROM follows audience_follow
                WHERE audience_follow.follower_id = ${viewerId}
                  AND audience_follow.following_id = audience_author.id
              )
            )
          )
      )`;
  return and(postTypeVisibility, groupVisibility, authorAudienceVisibility)!;
}