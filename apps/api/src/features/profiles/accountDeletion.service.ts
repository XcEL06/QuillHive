import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { educationHistoryTable, postsTable, usersTable, workHistoryTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { disconnectUserSockets } from "../../lib/socket";
import { hashPassword } from "../../lib/auth";
import { deletePostsPermanently } from "../posts/post.service";

export async function permanentlyDeleteAccountData(userId: number) {
  const deletedAt = new Date();
  const deletionId = randomBytes(8).toString("hex");
  await db.transaction(async (tx) => {
    const posts = await tx.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, userId));
    await deletePostsPermanently(posts.map(({ id }) => id), tx);
    await tx.delete(workHistoryTable).where(eq(workHistoryTable.userId, userId));
    await tx.delete(educationHistoryTable).where(eq(educationHistoryTable.userId, userId));
    await tx.update(usersTable).set({
      isDeleted: true,
      deletedAt,
      email: `deleted-${userId}-${deletionId}@deleted.local`,
      username: `deleted_${userId}_${deletionId}`,
      displayName: "Deleted user",
      bio: null,
      headline: null,
      avatarUrl: null,
      coverUrl: null,
      website: null,
      location: null,
      country: null,
      facebook: null,
      linkedin: null,
      twitter: null,
      instagram: null,
      signupIpHash: null,
      signupUserAgent: null,
      lastKnownIPHash: null,
      lastKnownCountry: null,
      lastKnownTimezone: null,
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      authVersion: sql`${usersTable.authVersion} + 1`,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    }).where(eq(usersTable.id, userId));
  });
  await disconnectUserSockets(userId);
}
