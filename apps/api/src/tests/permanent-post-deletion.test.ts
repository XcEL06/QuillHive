import { describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { deletePostsPermanently } from "../features/posts/post.service";

describe("permanent post deletion", () => {
  it("removes dependent rows and detaches retained tip records before deleting posts", async () => {
    const query = {
      from: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
    };
    const deletedTables: unknown[] = [];
    query.from.mockReturnValue(query);
    query.set.mockReturnValue(query);
    query.where.mockImplementation(() => Promise.resolve([{ id: 17 }, { id: 18 }]));
    const executor = {
      select: vi.fn(() => query),
      update: vi.fn(() => query),
      delete: vi.fn((table: unknown) => {
        deletedTables.push(table);
        return query;
      }),
    };

    await deletePostsPermanently([3, 4], executor as never);

    expect(deletedTables).toContain(schema.commentLikesTable);
    expect(deletedTables).toContain(schema.commentsTable);
    expect(deletedTables).toContain(schema.likesTable);
    expect(deletedTables).toContain(schema.postTopicsTable);
    expect(deletedTables).toContain(schema.collectionPostsTable);
    expect(deletedTables).toContain(schema.writingActivityTable);
    expect(deletedTables.at(-1)).toBe(schema.postsTable);
    expect(executor.update).toHaveBeenCalledWith(schema.postsTable);
    expect(executor.update).toHaveBeenCalledWith(schema.creatorTipsTable);
  });

  it("does not issue database operations for an empty post list", async () => {
    const executor = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    await deletePostsPermanently([], executor as never);

    expect(executor.select).not.toHaveBeenCalled();
    expect(executor.update).not.toHaveBeenCalled();
    expect(executor.delete).not.toHaveBeenCalled();
  });
});
