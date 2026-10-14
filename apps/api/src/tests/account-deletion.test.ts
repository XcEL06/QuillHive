import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  disconnectUserSockets: vi.fn(),
  invalidateUserCache: vi.fn(),
  deletePostsPermanently: vi.fn(),
}));

vi.mock("@workspace/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("../lib/socket", () => ({ disconnectUserSockets: mocks.disconnectUserSockets }));
vi.mock("../features/posts/post.service", () => ({ deletePostsPermanently: mocks.deletePostsPermanently }));
vi.mock("../features/profiles/profile.service", () => ({ invalidateUserCache: mocks.invalidateUserCache }));
vi.mock("../lib/auth", () => ({ hashPassword: vi.fn(() => "revoked-password-hash") }));

import { permanentlyDeleteAccountData } from "../features/profiles/accountDeletion.service";

describe("permanent account deletion", () => {
  afterEach(() => vi.clearAllMocks());

  it("keeps a restorable account tombstone and permanently removes authored feed content", async () => {
    let selectedTable: unknown;
    const updates: Array<{ table: unknown; values: unknown }> = [];
    const deletedTables: unknown[] = [];
    const selectBuilder = {
      from: vi.fn((table: unknown) => {
        selectedTable = table;
        return selectBuilder;
      }),
      where: vi.fn(async () => {
        if (selectedTable === schema.postsTable) return [{ id: 11 }];
        if (selectedTable === schema.commentsTable) return [{ id: 12 }];
        if (selectedTable === schema.seriesTable) return [{ id: 14 }];
        if (selectedTable === schema.jobsTable) return [{ id: 13 }];
        if (selectedTable === schema.serviceListingsTable) return [{ id: 15 }];
        return [];
      }),
    };
    const updateBuilder = {
      set: vi.fn(function (this: { table: unknown }, values: unknown) {
        updates.push({ table: this.table, values });
        return updateBuilder;
      }),
      where: vi.fn(async () => []),
    };
    const deleteBuilder = {
      where: vi.fn(async () => []),
    };
    const tx = {
      select: vi.fn(() => selectBuilder),
      update: vi.fn((table: unknown) => {
        Object.assign(updateBuilder, { table });
        return updateBuilder;
      }),
      delete: vi.fn((table: unknown) => {
        deletedTables.push(table);
        return deleteBuilder;
      }),
    };
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx));

    await permanentlyDeleteAccountData(7);

    expect(mocks.deletePostsPermanently).toHaveBeenCalledWith([11], tx);
    expect(deletedTables).toContain(schema.commentsTable);
    expect(deletedTables).toContain(schema.commentLikesTable);
    expect(deletedTables).toContain(schema.seriesTable);
    expect(deletedTables).toContain(schema.chainEntriesTable);
    expect(deletedTables).toContain(schema.chainsTable);
    expect(deletedTables).toContain(schema.jobsTable);
    expect(deletedTables).toContain(schema.opportunityApplicationsTable);
    expect(deletedTables).toContain(schema.serviceListingsTable);
    expect(deletedTables).toContain(schema.sessionsTable);
    expect(deletedTables).toContain(schema.emailVerificationTokensTable);
    expect(deletedTables).not.toContain(schema.followsTable);
    expect(deletedTables).not.toContain(schema.libraryEntriesTable);
    expect(deletedTables).not.toContain(schema.workHistoryTable);
    expect(deletedTables).not.toContain(schema.educationHistoryTable);
    expect(deletedTables).not.toContain(schema.portfolioItemsTable);
    expect(deletedTables).not.toContain(schema.creatorProfilesTable);
    expect(deletedTables).not.toContain(schema.conversationsTable);
    expect(updates).toContainEqual(expect.objectContaining({
      table: schema.conversationsTable,
      values: { opportunityId: null },
    }));
    expect(updates).toContainEqual(expect.objectContaining({
      table: schema.postsTable,
      values: { seriesId: null },
    }));
    expect(updates).toContainEqual(expect.objectContaining({
      table: schema.creatorPaymentTransactionsTable,
      values: { serviceListingId: null },
    }));
    const tombstoneUpdate = updates.find(({ table }) => table === schema.usersTable)?.values as Record<string, unknown>;
    expect(tombstoneUpdate.isDeleted).toBe(true);
    expect(tombstoneUpdate.passwordHash).toBe("revoked-password-hash");
    for (const field of ["email", "username", "displayName", "bio"]) {
      expect(tombstoneUpdate).not.toHaveProperty(field);
    }
    expect(mocks.disconnectUserSockets).toHaveBeenCalledWith(7);
    expect(mocks.invalidateUserCache).toHaveBeenCalledWith(7);
  });
});
