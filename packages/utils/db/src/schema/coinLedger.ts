import { pgTable, serial, integer, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const coinLedgerTable = pgTable("coin_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: integer("amount").notNull(),
  source: text("source").notNull(),
  basis: text("basis").notNull(),
  reason: text("reason").notNull(),
  adminId: integer("admin_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  positiveAmount: check("coin_ledger_amount_positive", sql`${table.amount} > 0`),
  userCreatedAtIdx: index("coin_ledger_user_created_at_idx").on(table.userId, table.createdAt),
  adminIdx: index("coin_ledger_admin_id_idx").on(table.adminId),
}));

export type CoinLedgerEntry = typeof coinLedgerTable.$inferSelect;
