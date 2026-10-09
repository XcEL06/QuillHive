import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

export const OFFICIAL_SYSTEM_ACCOUNT = {
  username: "quillhive",
  email: "system@quillhive.app",
} as const;

export async function getOfficialSystemAccountId(): Promise<number> {
  const [account] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      isOfficialAccount: usersTable.isOfficialAccount,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.email, OFFICIAL_SYSTEM_ACCOUNT.email),
      eq(usersTable.isDeleted, false),
    ))
    .limit(1);

  if (
    !account ||
    account.username !== OFFICIAL_SYSTEM_ACCOUNT.username ||
    account.isOfficialAccount !== true
  ) {
    throw new Error("The official QuillHive system account is unavailable.");
  }

  return account.id;
}

type OfficialSystemAccountIdentity = {
  username: string;
  email: string;
  isOfficialAccount: boolean;
};

export function assertOfficialSystemAccount(account: OfficialSystemAccountIdentity): void {
  if (
    account.isOfficialAccount !== true ||
    account.username !== OFFICIAL_SYSTEM_ACCOUNT.username ||
    account.email !== OFFICIAL_SYSTEM_ACCOUNT.email
  ) {
    throw new Error("Refusing to disable password login for a non-system account.");
  }
}