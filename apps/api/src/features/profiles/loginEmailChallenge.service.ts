import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { loginEmailChallengesTable } from "@workspace/db/schema";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { sendEmail } from "../email/email.service";

const CHALLENGE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export type LoginChallengeMetadata = {
  ipHash: string;
  userAgent?: string | null;
  country: string | null;
  timezone: string | null;
};

function challengeSecret(): string {
  return process.env.LOGIN_CODE_SECRET
    || process.env.JWT_SECRET
    || "quillhive-development-login-code-secret";
}

function hashCode(userId: number, nonce: string, code: string): string {
  return createHmac("sha256", challengeSecret())
    .update(`${userId}:${nonce}:${code}`)
    .digest("hex");
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.length < 3 ? local.slice(0, 1) : `${local[0]}${"*".repeat(Math.min(local.length - 2, 8))}${local.at(-1)}`;
  return `${visible}@${domain}`;
}

export async function createLoginEmailChallenge(input: {
  userId: number;
  authVersion: number;
  email: string;
  metadata: LoginChallengeMetadata;
}) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db.update(loginEmailChallengesTable)
    .set({ usedAt: new Date() })
    .where(and(
      eq(loginEmailChallengesTable.userId, input.userId),
      isNull(loginEmailChallengesTable.usedAt),
      gt(loginEmailChallengesTable.expiresAt, new Date()),
    ));
  const [challenge] = await db.insert(loginEmailChallengesTable).values({
    userId: input.userId,
    authVersion: input.authVersion,
    codeHash: hashCode(input.userId, nonce, code),
    nonce,
    ipHash: input.metadata.ipHash,
    userAgent: input.metadata.userAgent ?? null,
    country: input.metadata.country,
    timezone: input.metadata.timezone,
    expiresAt,
  }).returning({ id: loginEmailChallengesTable.id });

  if (!challenge) throw new Error("Could not create a sign-in verification challenge.");

  const delivery = await sendEmail({
    to: input.email,
    subject: "Your QuillHive sign-in code",
    text: `Your QuillHive sign-in code is ${code}. It expires in 10 minutes. If you did not try to sign in, you can ignore this email and secure your account.`,
    html: `<p>Your QuillHive sign-in code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not try to sign in, ignore this email and secure your account.</p>`,
  });

  if (!delivery.ok) {
    await db.update(loginEmailChallengesTable)
      .set({ usedAt: new Date() })
      .where(eq(loginEmailChallengesTable.id, challenge.id));
    throw new Error("We could not send a verification code to your email. Please try signing in again later.");
  }

  return {
    challengeId: challenge.id,
    email: maskEmail(input.email),
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

export async function verifyLoginEmailChallenge(challengeId: number, code: string) {
  const now = new Date();
  const [challenge] = await db.select().from(loginEmailChallengesTable).where(and(
    eq(loginEmailChallengesTable.id, challengeId),
    isNull(loginEmailChallengesTable.usedAt),
    gt(loginEmailChallengesTable.expiresAt, now),
    lt(loginEmailChallengesTable.attempts, MAX_ATTEMPTS),
  )).limit(1);

  if (!challenge) return null;

  const actualHash = Buffer.from(hashCode(challenge.userId, challenge.nonce, code), "hex");
  const expectedHash = Buffer.from(challenge.codeHash, "hex");
  const isValid = actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);

  if (!isValid) {
    await db.update(loginEmailChallengesTable)
      .set({ attempts: sql`${loginEmailChallengesTable.attempts} + 1` })
      .where(and(
        eq(loginEmailChallengesTable.id, challenge.id),
        isNull(loginEmailChallengesTable.usedAt),
        gt(loginEmailChallengesTable.expiresAt, now),
        lt(loginEmailChallengesTable.attempts, MAX_ATTEMPTS),
      ));
    return null;
  }

  const [consumed] = await db.update(loginEmailChallengesTable)
    .set({ usedAt: now })
    .where(and(
      eq(loginEmailChallengesTable.id, challenge.id),
      isNull(loginEmailChallengesTable.usedAt),
      gt(loginEmailChallengesTable.expiresAt, now),
      lt(loginEmailChallengesTable.attempts, MAX_ATTEMPTS),
    ))
    .returning({
      id: loginEmailChallengesTable.id,
      userId: loginEmailChallengesTable.userId,
      authVersion: loginEmailChallengesTable.authVersion,
      ipHash: loginEmailChallengesTable.ipHash,
      userAgent: loginEmailChallengesTable.userAgent,
      country: loginEmailChallengesTable.country,
      timezone: loginEmailChallengesTable.timezone,
    });

  return consumed ?? null;
}
