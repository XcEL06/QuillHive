import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  commentsTable,
  commentLikesTable,
  commissionRequestsTable,
  conversationsTable,
  creatorPaymentTransactionsTable,
  emailVerificationTokensTable,
  chainEntriesTable,
  chainsTable,
  jobsTable,
  opportunityApplicationsTable,
  postsTable,
  seriesTable,
  serviceListingsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { disconnectUserSockets } from "../../lib/socket";
import { hashPassword } from "../../lib/auth";
import { deletePostsPermanently } from "../posts/post.service";
import { invalidateUserCache } from "./profile.service";

export async function permanentlyDeleteAccountData(userId: number) {
  const deletedAt = new Date();
  await db.transaction(async (tx) => {
    const posts = await tx.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, userId));
    await deletePostsPermanently(posts.map(({ id }) => id), tx);

    const comments = await tx.select({ id: commentsTable.id })
      .from(commentsTable)
      .where(eq(commentsTable.authorId, userId));
    const commentIds = comments.map(({ id }) => id);
    if (commentIds.length > 0) {
      await tx.update(commentsTable).set({ parentCommentId: null })
        .where(inArray(commentsTable.parentCommentId, commentIds));
      await tx.delete(commentLikesTable).where(inArray(commentLikesTable.commentId, commentIds));
      await tx.delete(commentsTable).where(inArray(commentsTable.id, commentIds));
    }

    const series = await tx.select({ id: seriesTable.id })
      .from(seriesTable)
      .where(eq(seriesTable.userId, userId));
    const seriesIds = series.map(({ id }) => id);
    if (seriesIds.length > 0) {
      await tx.update(postsTable).set({ seriesId: null })
        .where(inArray(postsTable.seriesId, seriesIds));
      await tx.delete(seriesTable).where(inArray(seriesTable.id, seriesIds));
    }

    await tx.delete(chainEntriesTable).where(eq(chainEntriesTable.authorId, userId));
    await tx.delete(chainsTable).where(eq(chainsTable.creatorId, userId));

    const jobs = await tx.select({ id: jobsTable.id })
      .from(jobsTable)
      .where(eq(jobsTable.authorId, userId));
    const jobIds = jobs.map(({ id }) => id);
    if (jobIds.length > 0) {
      await tx.update(conversationsTable).set({ opportunityId: null })
        .where(inArray(conversationsTable.opportunityId, jobIds));
      await tx.delete(opportunityApplicationsTable).where(inArray(opportunityApplicationsTable.jobId, jobIds));
      await tx.delete(jobsTable).where(inArray(jobsTable.id, jobIds));
    }

    const serviceListings = await tx.select({ id: serviceListingsTable.id })
      .from(serviceListingsTable)
      .where(eq(serviceListingsTable.creatorId, userId));
    const serviceListingIds = serviceListings.map(({ id }) => id);
    if (serviceListingIds.length > 0) {
      await tx.update(commissionRequestsTable).set({ serviceListingId: null })
        .where(inArray(commissionRequestsTable.serviceListingId, serviceListingIds));
      await tx.update(creatorPaymentTransactionsTable).set({ serviceListingId: null })
        .where(inArray(creatorPaymentTransactionsTable.serviceListingId, serviceListingIds));
      await tx.delete(serviceListingsTable).where(inArray(serviceListingsTable.id, serviceListingIds));
    }

    await tx.delete(opportunityApplicationsTable).where(eq(opportunityApplicationsTable.applicantId, userId));
    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await tx.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, userId));

    await tx.update(usersTable).set({
      isDeleted: true,
      deletedAt,
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
  await invalidateUserCache(userId);
}
