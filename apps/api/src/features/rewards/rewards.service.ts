import crypto from "crypto";
import { db } from "@workspace/db";
import { inviteCodesTable } from "@workspace/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function getOrCreateReferralCode(userId: number) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(742013, ${userId})`);

    const [existing] = await tx.select()
      .from(inviteCodesTable)
      .where(and(
        eq(inviteCodesTable.createdBy, userId),
        isNull(inviteCodesTable.expiresAt),
        eq(inviteCodesTable.isActive, true),
      ))
      .orderBy(inviteCodesTable.createdAt, inviteCodesTable.id)
      .limit(1);

    const invite = existing ?? (await tx.insert(inviteCodesTable)
      .values({
        code: crypto.randomBytes(8).toString("hex").toUpperCase(),
        createdBy: userId,
        expiresAt: null,
      })
      .returning())[0];

    if (!invite) throw new Error("Unable to create a referral code");

    await tx.update(inviteCodesTable)
      .set({ isActive: false })
      .where(and(
        eq(inviteCodesTable.createdBy, userId),
        isNull(inviteCodesTable.expiresAt),
        eq(inviteCodesTable.isActive, true),
        ne(inviteCodesTable.id, invite.id),
      ));

    return invite;
  });
}
