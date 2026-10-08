export const OFFICIAL_SYSTEM_ACCOUNT = {
  username: "quillhive",
  email: "system@quillhive.app",
} as const;

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