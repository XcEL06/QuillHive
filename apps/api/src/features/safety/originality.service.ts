import { db } from "@workspace/db";
import { postFingerprintsTable, postsTable } from "@workspace/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { logger } from "../../lib/logger";

const SHINGLE_SIZE = 5;

function normalize(text: string): string {
  return text.toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function shingleHashes(text: string): string[] {
  const normalized = normalize(text);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < SHINGLE_SIZE) return [];
  const hashes = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= tokens.length; i++) {
    const slice = tokens.slice(i, i + SHINGLE_SIZE).join(" ");
    hashes.add(crypto.createHash("sha1").update(slice).digest("hex").slice(0, 16));
  }
  return [...hashes];
}

export function combinedFingerprint(hashes: string[]): string {
  if (hashes.length === 0) return "";
  return crypto.createHash("sha1").update(hashes.sort().join("|")).digest("hex");
}

/**
 * Index a post's shingles. Replaces any prior fingerprints for the same post.
 * Best-effort: failures are logged, never thrown.
 */
export async function indexPostFingerprint(postId: number, content: string): Promise<string | null> {
  try {
    const hashes = shingleHashes(content);
    if (hashes.length === 0) return null;
    await db.delete(postFingerprintsTable).where(eq(postFingerprintsTable.postId, postId));
    await db.insert(postFingerprintsTable).values(hashes.map((h) => ({ postId, shingle: h })));
    const fp = combinedFingerprint(hashes);
    await db.update(postsTable).set({ fingerprint: fp }).where(eq(postsTable.id, postId));
    return fp;
  } catch (err) {
    logger.error({ err, postId }, "indexPostFingerprint failed");
    return null;
  }
}

/**
 * Find similar posts. Returns up to `limit` posts whose Jaccard-ish overlap
 * exceeds `threshold` (0..1). Excludes the requested post, deleted/unpublished
 * posts, and optionally all posts from one author.
 */
export async function findSimilarPosts(
  content: string,
  excludePostId: number | null = null,
  threshold = 0.85,
  limit = 5,
  excludeAuthorId: number | null = null,
): Promise<Array<{ postId: number; similarity: number }>> {
  const hashes = shingleHashes(content);
  if (hashes.length === 0) return [];

  const rows = await db
    .select({ postId: postFingerprintsTable.postId, count: sql<number>`count(*)::int` })
    .from(postFingerprintsTable)
    .innerJoin(postsTable, eq(postsTable.id, postFingerprintsTable.postId))
    .where(and(
      inArray(postFingerprintsTable.shingle, hashes),
      excludePostId ? ne(postFingerprintsTable.postId, excludePostId) : undefined,
      excludeAuthorId ? ne(postsTable.authorId, excludeAuthorId) : undefined,
      eq(postsTable.isDeleted, false),
      eq(postsTable.isPublished, true),
    ))
    .groupBy(postFingerprintsTable.postId)
    .orderBy(sql`count(*) desc`)
    .limit(limit * 4);

  const results: Array<{ postId: number; similarity: number }> = [];
  for (const row of rows) {
    const sim = row.count / hashes.length;
    if (sim >= threshold) results.push({ postId: row.postId, similarity: sim });
  }
  return results.slice(0, limit);
}
