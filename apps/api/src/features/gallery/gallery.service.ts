import { db } from "@workspace/db";
import { portfolioItemsTable, followsTable } from "@workspace/db/schema";
import { eq, and, desc, or } from "drizzle-orm";

export async function getPortfolioItems(userId: number, viewerId: number | null) {
  if (viewerId === userId) {
    return db.select().from(portfolioItemsTable)
      .where(eq(portfolioItemsTable.userId, userId))
      .orderBy(desc(portfolioItemsTable.createdAt));
  }
  const [follow] = viewerId === null ? [] : await db.select({ id: followsTable.followerId })
    .from(followsTable)
    .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, userId)));
  return db
    .select()
    .from(portfolioItemsTable)
    .where(
      and(
        eq(portfolioItemsTable.userId, userId),
        follow
          ? or(eq(portfolioItemsTable.visibility, "public"), eq(portfolioItemsTable.visibility, "followers"))
          : eq(portfolioItemsTable.visibility, "public"),
      )
    )
    .orderBy(desc(portfolioItemsTable.createdAt));
}

export async function addPortfolioItem(
  userId: number,
  data: { title: string; description?: string; mediaUrl: string; evidenceUrl?: string; category?: string; visibility?: string }
) {
  const [item] = await db
    .insert(portfolioItemsTable)
    .values({
      userId,
      title: data.title,
      description: data.description || null,
      mediaUrl: data.mediaUrl,
      evidenceUrl: data.evidenceUrl || null,
      category: data.category || "general",
      visibility: data.visibility || "public",
    })
    .returning();
  return item;
}

export async function updatePortfolioItem(
  id: number,
  userId: number,
  data: { title: string; description?: string; mediaUrl: string; evidenceUrl?: string; category?: string; visibility?: string },
) {
  const [item] = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.id, id));
  if (!item) return null;
  if (item.userId !== userId) throw new Error("Forbidden");
  const [updated] = await db
    .update(portfolioItemsTable)
    .set({
      title: data.title,
      description: data.description || null,
      mediaUrl: data.mediaUrl,
      evidenceUrl: data.evidenceUrl || null,
      category: data.category || "general",
      visibility: data.visibility || "public",
    })
    .where(eq(portfolioItemsTable.id, id))
    .returning();
  return updated;
}

export async function deletePortfolioItem(id: number, userId: number) {
  const [item] = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.id, id));
  if (!item) return null;
  if (item.userId !== userId) throw new Error("Forbidden");
  await db.delete(portfolioItemsTable).where(eq(portfolioItemsTable.id, id));
  return true;
}
