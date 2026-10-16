import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { followsTable } from "@workspace/db/schema";
import { isBlockedBetween } from "../safety/blocks.service";
import { canViewProfileWithSignals } from "./profileAccessPolicy";

export { canViewProfileWithSignals } from "./profileAccessPolicy";

export async function canViewProfile(profileUser: {
  id: number;
  profileVisibility: string;
}, viewerId: number | null): Promise<boolean> {
  const isSelf = viewerId === profileUser.id;
  const isBlocked = !isSelf && viewerId !== null
    ? await isBlockedBetween(viewerId, profileUser.id)
    : false;
  const [follow] = !isSelf && viewerId !== null && profileUser.profileVisibility === "followers"
    ? await db.select({ id: followsTable.followerId }).from(followsTable).where(and(
      eq(followsTable.followerId, viewerId),
      eq(followsTable.followingId, profileUser.id),
    ))
    : [];
  return canViewProfileWithSignals({
    profileUserId: profileUser.id,
    viewerId,
    profileVisibility: profileUser.profileVisibility,
    isBlocked,
    isFollowing: Boolean(follow),
  });
}
