import { Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, postsTable, commentsTable, followsTable, likesTable, sessionsTable } from "@workspace/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, getSessionUserId, destroySession } from "../../lib/auth";
import { createEmailVerification, getPublicAppUrl, sendEmail } from "../email/email.service";
import { logger } from "../../lib/logger";
import { disconnectUserSockets } from "../../lib/socket";

function getUserIdFromAuth(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export const forgotPassword = async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  // Always respond OK to avoid user enumeration - but log and 500 in prod if email fails.
  if (!email) return res.json({ success: true });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + RESET_TTL_MS);
    await db.update(usersTable)
      .set({ passwordResetTokenHash: tokenHash, passwordResetExpires: expires })
      .where(eq(usersTable.id, user.id));

    const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const brand = process.env.BRAND_NAME || "QuillHive";

    logger.info({ userId: user.id }, "Password reset requested - sending email");

    try {
      const result = await sendEmail({
        to: email,
        subject: `Reset your ${brand} password`,
        html:
          `<p>You requested a password reset for your ${brand} account.</p>` +
          `<p><a href="${resetUrl}">Click here to reset your password</a></p>` +
          `<p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
        text: `Reset your ${brand} password: ${resetUrl}\nExpires in 1 hour.`,
      });
      if (!result.ok) {
        logger.warn({ userId: user.id, reason: result.error }, "Password reset email unavailable");
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({
            error: result.error || "Email delivery is temporarily unavailable. Please try again later.",
          });
        }
      } else {
        logger.info({ userId: user.id, email }, "Password reset email sent successfully");
      }
    } catch (err) {
      logger.error({ err, userId: user.id, email }, "Failed to send password reset email");
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({
          error: "Failed to send reset email. Please try again later or contact support.",
        });
      }
      // In dev: fall through and expose the link
    }

    if (process.env.NODE_ENV !== "production") {
      logger.warn({ email, resetUrl }, "[DEV] Password reset link (email not sent in dev mode)");
      return res.json({ success: true, devResetUrl: resetUrl });
    }
  }

  return res.json({ success: true });
};

export const resetPassword = async (req: Request, res: Response) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token || password.length < 8) {
    return res.status(400).json({ error: "Invalid token or password too short" });
  }
  const tokenHash = hashToken(token);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.passwordResetTokenHash, tokenHash), gt(usersTable.passwordResetExpires, new Date())));
  if (!user) return res.status(400).json({ error: "Invalid or expired token" });

  await db.update(usersTable).set({
    passwordHash: hashPassword(password),
    authVersion: sql`${usersTable.authVersion} + 1`,
    passwordResetTokenHash: null,
    passwordResetExpires: null,
  }).where(eq(usersTable.id, user.id));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
  disconnectUserSockets(user.id);
  return res.json({ success: true });
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  await db.update(usersTable).set({
    passwordHash: hashPassword(newPassword),
    authVersion: sql`${usersTable.authVersion} + 1`,
  }).where(eq(usersTable.id, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  disconnectUserSockets(userId);
  return res.json({ success: true });
};

export const resendVerification = async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!email) return res.json({ success: true });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user && !user.emailVerified) {
    const verificationToken = await createEmailVerification(user.id);
    const verificationUrl = `${getPublicAppUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const result = await sendEmail({
      to: email,
      subject: "Verify your QuillHive email",
      html: `<p>Please verify your QuillHive email address.</p><p><a href="${verificationUrl}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Verify your QuillHive email: ${verificationUrl}\nThis link expires in 24 hours.`,
    });
    if (!result.ok && process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: result.error || "Email delivery is unavailable. Please try again later." });
    }
    if (process.env.NODE_ENV !== "production") {
      return res.json({ success: true, emailSent: result.ok, devVerificationToken: verificationToken, devVerificationUrl: verificationUrl, message: result.ok ? "Verification email sent." : result.error });
    }
  }
  return res.json({ success: true });
};

export const exportMyData = async (req: Request, res: Response) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return res.status(404).json({ error: "Not found" });
  const posts = await db.select().from(postsTable).where(eq(postsTable.authorId, userId));
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.authorId, userId));
  const following = await db.select().from(followsTable).where(eq(followsTable.followerId, userId));
  const likes = await db.select().from(likesTable).where(eq(likesTable.userId, userId));

  const { passwordHash, passwordResetTokenHash, twoFactorSecret, ...safeUser } = user as any;
  res.setHeader("Content-Disposition", `attachment; filename="quillhive-export-${userId}.json"`);
  res.setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify({
    exportedAt: new Date().toISOString(),
    user: safeUser,
    posts,
    comments,
    following,
    likes,
  }, null, 2));
};

export const deleteMyAccount = async (req: Request, res: Response) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const confirm = String(req.body?.confirm || "");
  if (confirm !== "DELETE") {
    return res.status(400).json({ error: "Type DELETE to confirm" });
  }

  // Soft delete: anonymize + mark deleted, preserves referential integrity.
  await db.update(usersTable).set({
    isDeleted: true,
    deletedAt: new Date(),
    email: `deleted-${userId}-${Date.now()}@deleted.local`,
    username: `deleted_${userId}_${Date.now()}`,
    displayName: "Deleted user",
    bio: null,
    headline: null,
    avatarUrl: null,
    coverUrl: null,
    website: null,
    location: null,
    country: null,
    facebook: null,
    linkedin: null,
    twitter: null,
    instagram: null,
    passwordHash: hashPassword(randomBytes(32).toString("hex")),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    passwordResetTokenHash: null,
    passwordResetExpires: null,
  }).where(eq(usersTable.id, userId));

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) await destroySession(auth.slice(7));
  return res.json({ success: true });
};
