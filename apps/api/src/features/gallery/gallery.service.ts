import { db } from "@workspace/db";
import { portfolioItemsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getPortfolioItems(userId: number, viewerId: number | null) {
  return db
    .select()
    .from(portfolioItemsTable)
    .where(
      viewerId === userId
        ? eq(portfolioItemsTable.userId, userId)
        : and(eq(portfolioItemsTable.userId, userId), eq(portfolioItemsTable.visibility, "public"))
    )
    .orderBy(desc(portfolioItemsTable.createdAt));
}

export async function addPortfolioItem(
  userId: number,
  data: { title: string; description?: string; mediaUrl: string; category?: string; visibility?: string }
) {
  const [item] = await db
    .insert(portfolioItemsTable)
    .values({
      userId,
      title: data.title,
      description: data.description || null,
      mediaUrl: data.mediaUrl,
      category: data.category || "general",
      visibility: data.visibility || "public",
    })
    .returning();
  return item;
}

export async function updatePortfolioItem(
  id: number,
  userId: number,
  data: { title: string; description?: string; mediaUrl: string; category?: string; visibility?: string },
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
