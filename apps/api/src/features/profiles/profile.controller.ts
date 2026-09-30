import { Request, Response } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { usersTable, followsTable, postsTable, commentsTable, likesTable, postTopicsTable, userTrustScoresTable, workHistoryTable, educationHistoryTable, savedPostsTable, profileViewsTable } from "@workspace/db/schema";
import { eq, and, sql, ilike, desc, or, inArray, notInArray } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
  createAuthTokens,
  refreshSession,
  getSessionUserId,
  destroySession,
  blacklistToken,
} from "../../lib/auth";
import {
  getUserWithCounts,
  invalidateUserCache,
  enrichPost,
  getCreatorProfile,
  upsertCreatorProfile,
} from "./profile.service";
import {
  checkEmail,
  createEmailVerification,
  logBlockedEmailAttempt,
  verifyEmailToken,
  getPublicAppUrl,
} from "../email/email.service";
import { recordLoginIntegrity, getLoginMeta } from "../security/locationIntegrity";
import { emitEvent, maskIp } from "../../lib/events";
import { recordSignup } from "../../lib/alertEngine";
import { visiblePostExpiryCondition } from "../posts/postExpiry";
import { postVisibilityCondition } from "../posts/postVisibility";
import { consumeInvite } from "../invites/invites.routes";
import { sendEmail } from "../email/email.service";
import { welcomeEmailHtml, welcomeEmailText } from "../email/email.templates";
import { getRedis } from "../../lib/redis";

function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

// ─── Reserved usernames ───────────────────────────────────────────────────────

const RESERVED_USERNAMES = new Set([
  // Platform identity
  "quillhive","quill","hive","qh","quillhiveapp","quillhiveteam","quillhiveofficial","quillhivehq",
  // Owner reserved
  "xcel","xcel06","xcell",
  // Platform roles
  "admin","administrator","superadmin","super_admin","moderator","mod","staff","team","official",
  "support","help","helpdesk","contact","security","abuse","trust","safety",
  "legal","privacy","dmca","appeals","billing","payments","finance",
  "press","media","news","blog","careers","jobs","hiring","partner","partners","business",
  "ambassador","creator",
  // Technical routes
  "api","www","app","mail","smtp","ftp","dev","staging","beta","alpha","test",
  "demo","example","sandbox","preview","localhost","root","system","platform",
  "null","undefined","true","false","none","anonymous","deleted","ghost","unknown",
  // Platform feature routes
  "write","post","spark","motion","studio","explore","discover","trending","featured",
  "home","feed","timeline","dashboard","analytics","promotions","boost",
  "workspace","library","collections","groups","community","circles",
  "notifications","alerts","messages","settings","profile","account","onboarding",
  "invite","referral","affiliates","about","terms","privacy","cookie",
  "sitemap","robots","favicon","login","logout","signup","register",
  "auth","oauth","callback","verify","search","tags","topics","hashtag",
  "chains","series","highlights","saved","bookmarks","drafts","scheduled","published",
  "pro","premium","plus","enterprise","free","trial","upgrade","downgrade",
  "everyone","all","me","you","we","us","god","real","original",
  "verified","certified","trusted","no-reply","noreply","donotreply",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
]);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response) => {
  const { username, email, password, displayName } = req.body;
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const refRaw = (req.body?.ref ?? req.query?.ref ?? "") as string;
  const inviteCodeRaw = (req.body?.inviteCode ?? req.query?.invite ?? "") as string;
  const referralSource = typeof refRaw === "string" ? refRaw.slice(0, 80) : null;
  const inviteCode = typeof inviteCodeRaw === "string" ? inviteCodeRaw.slice(0, 32) : "";
  if (!username || !email || !password || !displayName) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const emailDomain = normalizedEmail.split("@")[1];
  if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
    return res.status(400).json({
      error: "Please use a permanent email address to register.",
    });
  }
  // Only enforce Turnstile when the browser supplied a token. This makes a
  // partially configured deployment (secret present, widget/site key missing,
  // or the widget script unavailable) degrade gracefully instead of blocking
  // registration or crashing the SPA.
  if (process.env.NODE_ENV === "production" && process.env.TURNSTILE_SECRET_KEY && (req.body as any).turnstileToken) {
    const token = (req.body as any).turnstileToken;
    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: req.ip,
        }),
      });
      const { success } = await verifyRes.json() as { success: boolean };
      if (!success) {
        return res.status(400).json({ error: "Bot verification failed. Please try again." });
      }
    } catch {
      // If Turnstile verification is unavailable, allow registration rather
      // than turning a third-party outage into an auth outage.
    }
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return res.status(400).json({ error: "This username is reserved and cannot be registered." });
  }
  const emailCheck = checkEmail(email);
  if (!emailCheck.allowed) {
    await logBlockedEmailAttempt(email, emailCheck, req);
    return res.status(400).json({ error: emailCheck.reason || "Email is not allowed.", emailCheck });
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (existing.length > 0) return res.status(400).json({ error: "Email already registered" });

  const existingUsername = await (db as any).select().from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername.length > 0) return res.status(400).json({ error: "Username already taken" });

  const passwordHash = hashPassword(password);
  const loginMeta = getLoginMeta(req);
  const signupIpHash = createHash("sha256")
    .update((req.ip ?? "") + (process.env.JWT_SECRET ?? ""))
    .digest("hex");
  const [user] = await db.insert(usersTable).values({
    username,
    email: emailCheck.email,
    passwordHash,
    displayName,
    emailVerified: false,
    signupIpHash,
    signupUserAgent: req.headers["user-agent"] ?? null,
    lastKnownIPHash: loginMeta.ipHash,
    lastKnownCountry: loginMeta.country,
    lastKnownTimezone: loginMeta.timezone,
    locationIntegrityStatus: "normal",
    referralSource: referralSource || null,
  }).returning();

  // Consume invite code (optional) and link referredBy
  if (inviteCode) {
    try {
      const inviterId = await consumeInvite(inviteCode, user.id);
      if (inviterId) {
        await db.update(usersTable).set({ referredBy: inviterId }).where(eq(usersTable.id, user.id));
      }
    } catch {
      // never block registration on invite issues
    }
  }

  // Owner intelligence: signup signal
  recordSignup();
  emitEvent({
    type: "USER_EVENT",
    severity: "low",
    message: `New user signup: ${user.username}`,
    metadata: {
      type: "signup",
      userId: user.id,
      username: user.username,
      ipMasked: maskIp((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip),
      country: loginMeta.country,
      source: referralSource || undefined,
    },
  });

  const verificationToken = await createEmailVerification(user.id);

  // Send welcome email (fire-and-forget - never block registration)
  const appUrl = getPublicAppUrl();
  const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const emailResult = await sendEmail({
    to: emailCheck.email,
    subject: `Welcome to QuillHive, ${displayName}!`,
    html: welcomeEmailHtml({ displayName, username, appUrl, verificationUrl }),
    text: welcomeEmailText({ displayName, username, appUrl, verificationUrl }),
  });

  const userWithCounts = await getUserWithCounts(user.id, null);
  return res.status(201).json({
    verificationRequired: true,
    message: "Account created. Please verify your email to activate sign in.",
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
    verificationToken: process.env.NODE_ENV === "production" ? undefined : verificationToken,
    verificationUrl: process.env.NODE_ENV === "production" ? undefined : verificationUrl,
    user: userWithCounts,
  });
};

// In-memory tracker for repeated failed logins by email + IP (prevents one network from blocking others)
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const loginFailureLockoutMessage = 'Too many failed login attempts for this account. Please wait a few minutes and try again, or use "Forgot password" to reset it.';

function trackLoginFailure(ip: string, email: string): number {
  const normalizedEmail = (email || "unknown").trim().toLowerCase();
  const failKey = `${ip}:${normalizedEmail}`;
  const now = Date.now();
  const entry = loginFailures.get(failKey);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(failKey, { count: 1, resetAt: now + 10 * 60_000 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const normalizedEmail = String(email).trim().toLowerCase();
  const failKey = `${rawIp}:${normalizedEmail}`;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    const fails = trackLoginFailure(rawIp, email);
    if (fails >= 8) {
      emitEvent({
        type: "SECURITY_ALERT",
        severity: "high",
        message: `Repeated failed logins for account (${fails} attempts in 10m)`,
        metadata: { ipMasked: maskIp(rawIp), email: normalizedEmail, count: fails, reason: "user_not_found" },
      });
      return res.status(429).json({ error: loginFailureLockoutMessage });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const fails = trackLoginFailure(rawIp, email);
    if (fails >= 8) {
      emitEvent({
        type: "SECURITY_ALERT",
        severity: "high",
        message: `Repeated failed logins for account (${fails} attempts in 10m)`,
        metadata: { ipMasked: maskIp(rawIp), email: normalizedEmail, count: fails, reason: "bad_password", userId: user.id },
      });
      return res.status(429).json({ error: loginFailureLockoutMessage });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }
  loginFailures.delete(failKey);
  // Auto-upgrade weak SHA-256 hashes to scrypt on successful login
  if (isLegacyPasswordHash(user.passwordHash)) {
    void db.update(usersTable).set({ passwordHash: hashPassword(password) }).where(eq(usersTable.id, user.id));
  }
  if (!user.emailVerified) return res.status(403).json({ error: "Please verify your email before signing in." });

  const loginIntegrity = await recordLoginIntegrity(user.id, req);
  const authTokens = await createAuthTokens(user.id, { userAgent: loginIntegrity.userAgent, ipHash: loginIntegrity.ipHash });
  const userWithCounts = await getUserWithCounts(user.id, null);
  return res.json({ ...authTokens, user: userWithCounts, loginIntegrity: { status: loginIntegrity.integrityStatus, riskScore: loginIntegrity.riskScore } });
};

export const logout = async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    await blacklistToken(auth.slice(7));
    await destroySession(auth.slice(7));
  }
  if (typeof req.body?.refreshToken === "string") await destroySession(req.body.refreshToken);
  return res.json({ success: true });
};

export const refresh = async (req: Request, res: Response) => {
  const tokens = await refreshSession(req.body.refreshToken);
  if (!tokens) return res.status(401).json({ error: "Invalid refresh token" });
  return res.json(tokens);
};

export const verifyEmail = async (req: Request, res: Response) => {
  const user = await verifyEmailToken(req.body.token);
  if (!user) return res.status(400).json({ error: "Invalid or expired verification token." });
  const loginIntegrity = await recordLoginIntegrity(user.id, req);
  const authTokens = await createAuthTokens(user.id, { userAgent: loginIntegrity.userAgent, ipHash: loginIntegrity.ipHash });
  const userWithCounts = await getUserWithCounts(user.id, null);
  return res.json({ ...authTokens, user: userWithCounts, message: "Email verified successfully.", loginIntegrity: { status: loginIntegrity.integrityStatus, riskScore: loginIntegrity.riskScore } });
};

export const me = async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const userId = getSessionUserId(auth.slice(7));
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const userWithCounts = await getUserWithCounts(userId, null);
  if (!userWithCounts) return res.status(404).json({ error: "User not found" });
  return res.json(userWithCounts);
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const listUsers = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);

  let query = db.select().from(usersTable).$dynamic();
  if (search) query = query.where(ilike(usersTable.displayName, `%${search}%`));

  const users = await query.limit(limit).offset((page - 1) * limit);
  const result = await Promise.all(users.map(u => getUserWithCounts(u.id, viewerId)));
  return res.json({ users: result.filter(Boolean), total: result.length, page, limit });
};

export const searchUsers = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const q = ((req.query.q as string) || "").trim();
  const country = ((req.query.country as string) || "").trim();
  const skillsParam = ((req.query.skills as string) || "").trim();
  const category = ((req.query.category as string) || "").trim();

  if (!q && !country && !skillsParam && !category) return res.json([]);

  let query = db.select().from(usersTable).$dynamic();
  const conditions: any[] = [];
  if (q) conditions.push(or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)));
  if (country) conditions.push(ilike(usersTable.country, `%${country}%`));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const users = await query.limit(50);

  let filtered = users.filter(u => u.id !== viewerId);

  if (skillsParam || category) {
    const skillsList = skillsParam ? skillsParam.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const catLower = category.toLowerCase();

    const { creatorProfilesTable } = await import("@workspace/db/schema");
    const profiles = await db.select().from(creatorProfilesTable);
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    filtered = filtered.filter(u => {
      const profile = profileMap.get(u.id);
      if (!profile) return skillsList.length === 0 && !catLower;
      const skills: string[] = JSON.parse((profile as any).skills || "[]").map((s: string) => s.toLowerCase());
      const category_field = (profile as any).category?.toLowerCase() || "";
      const skillMatch = skillsList.length === 0 || skillsList.some(s => skills.some(sk => sk.includes(s)));
      const catMatch = !catLower || category_field.includes(catLower) || skills.some(s => s.includes(catLower));
      return skillMatch && catMatch;
    });
  }

  const result = await Promise.all(filtered.slice(0, 20).map(u => getUserWithCounts(u.id, viewerId)));
  return res.json(result.filter(Boolean));
};

export const getRecommendedUsers = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

  const allUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isDeleted, false), eq(usersTable.isBanned, false), eq(usersTable.showInSearch, true)))
    .limit(100);

  let candidates = allUsers.map(u => u.id).filter(id => id !== viewerId);

  if (viewerId) {
    const following = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, viewerId));
    const followingIds = new Set(following.map(f => f.followingId));
    candidates = candidates.filter(id => !followingIds.has(id));
  }

  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, limit);
  const result = await Promise.all(shuffled.map(id => getUserWithCounts(id, viewerId)));
  return res.json(result.filter(Boolean));
};

export const getSuggestedUsers = async (req: Request, res: Response) => {
  const viewerId = (req as any).currentUser.id as number;

  const [followingRows, trustRows] = await Promise.all([
    db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, viewerId)),
    db
      .select({
        userId: userTrustScoresTable.userId,
        cvs: userTrustScoresTable.cvs,
        bcs: userTrustScoresTable.bcs,
        cts: userTrustScoresTable.cts,
        avgCis: userTrustScoresTable.avgCis,
        uti: userTrustScoresTable.uti,
      })
      .from(userTrustScoresTable),
  ]);

  const followingIds = followingRows.map(row => row.followingId);
  const excludedIds = [viewerId, ...followingIds];

  const candidates = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.isDeleted, false),
      eq(usersTable.isBanned, false),
      eq(usersTable.showInSearch, true),
      notInArray(usersTable.id, excludedIds),
    ))
    .limit(500);

  if (candidates.length === 0) return res.json([]);

  const candidateIds = candidates.map(candidate => candidate.id);
  const [authoredTopics, likedTopics, commentedTopics] = await Promise.all([
    db.selectDistinct({ topicId: postTopicsTable.topicId })
      .from(postTopicsTable)
      .innerJoin(postsTable, eq(postsTable.id, postTopicsTable.postId))
      .where(and(eq(postsTable.authorId, viewerId), eq(postsTable.isDeleted, false))),
    db.selectDistinct({ topicId: postTopicsTable.topicId })
      .from(likesTable)
      .innerJoin(postTopicsTable, eq(postTopicsTable.postId, likesTable.postId))
      .innerJoin(postsTable, eq(postsTable.id, likesTable.postId))
      .where(and(eq(likesTable.userId, viewerId), eq(postsTable.isDeleted, false))),
    db.selectDistinct({ topicId: postTopicsTable.topicId })
      .from(commentsTable)
      .innerJoin(postTopicsTable, eq(postTopicsTable.postId, commentsTable.postId))
      .innerJoin(postsTable, eq(postsTable.id, commentsTable.postId))
      .where(and(eq(commentsTable.authorId, viewerId), eq(postsTable.isDeleted, false))),
  ]);

  const interactedTopicIds = new Set([
    ...authoredTopics.map(row => row.topicId),
    ...likedTopics.map(row => row.topicId),
    ...commentedTopics.map(row => row.topicId),
  ]);

  const [mutualRows, sharedRows] = await Promise.all([
    followingIds.length === 0 ? Promise.resolve([]) : db
      .selectDistinct({ userId: followsTable.followerId })
      .from(followsTable)
      .where(and(
        inArray(followsTable.followingId, followingIds),
        inArray(followsTable.followerId, candidateIds),
      )),
    interactedTopicIds.size === 0 ? Promise.resolve([]) : db
      .selectDistinct({ userId: likesTable.userId })
      .from(likesTable)
      .innerJoin(postTopicsTable, eq(postTopicsTable.postId, likesTable.postId))
      .innerJoin(postsTable, eq(postsTable.id, likesTable.postId))
      .where(and(
        inArray(likesTable.userId, candidateIds),
        inArray(postTopicsTable.topicId, [...interactedTopicIds]),
        eq(postsTable.isDeleted, false),
      ))
      .then(rows => rows.map(row => row.userId))
      .then(likeUsers => {
        const shared = new Set(likeUsers);
        return Promise.all([
          Promise.resolve(shared),
          db.selectDistinct({ userId: commentsTable.authorId })
            .from(commentsTable)
            .innerJoin(postTopicsTable, eq(postTopicsTable.postId, commentsTable.postId))
            .innerJoin(postsTable, eq(postsTable.id, commentsTable.postId))
            .where(and(
              inArray(commentsTable.authorId, candidateIds),
              inArray(postTopicsTable.topicId, [...interactedTopicIds]),
              eq(postsTable.isDeleted, false),
            )),
          db.selectDistinct({ userId: postsTable.authorId })
            .from(postsTable)
            .innerJoin(postTopicsTable, eq(postTopicsTable.postId, postsTable.id))
            .where(and(
              inArray(postsTable.authorId, candidateIds),
              inArray(postTopicsTable.topicId, [...interactedTopicIds]),
              eq(postsTable.isPublished, true),
              eq(postsTable.isDeleted, false),
            )),
        ]).then(([likeSet, commentRows, postRows]) => {
          const merged = new Set(likeSet);
          commentRows.forEach(row => merged.add(row.userId));
          postRows.forEach(row => merged.add(row.userId));
          return [...merged];
        });
      }),
  ]);

  const mutualIds = new Set(mutualRows.map(row => row.userId));
  const sharedTopicIds = new Set(sharedRows);
  const trustByUser = new Map(trustRows.map(row => [row.userId, row]));

  const ranked = candidates
    .map(candidate => {
      const trust = trustByUser.get(candidate.id);
      const trustValues = trust ? [trust.cvs, trust.bcs, trust.cts, trust.avgCis, trust.uti] : [];
      const normalizedTrust = trustValues.length > 0
        ? Math.max(0, Math.min(1, trustValues.reduce((sum, value) => sum + Number(value ?? 0), 0) / trustValues.length / 100))
        : 0;

      const mutualConnection = mutualIds.has(candidate.id);
      const sharesTopic = sharedTopicIds.has(candidate.id) && interactedTopicIds.size > 0;

      return {
        ...candidate,
        score: (mutualConnection ? 3 : 0) + (sharesTopic ? 2 : 0) + normalizedTrust,
        mutualConnection,
        sharesTopic,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const result = await Promise.all(ranked.map(async candidate => {
    const user = await getUserWithCounts(candidate.id, viewerId);
    return user
      ? { ...user, score: candidate.score, mutualConnection: candidate.mutualConnection, sharesTopic: candidate.sharesTopic }
      : null;
  }));

  return res.json(result.filter(Boolean));
};

export const getFeaturedUsers = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const now = new Date();

  const featured = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.isFeatured, true), eq(usersTable.isDeleted, false)))
    .limit(12);

  const valid = featured.filter(u => !u.featuredUntil || u.featuredUntil > now);
  const result = await Promise.all(valid.map(u => getUserWithCounts(u.id, viewerId)));
  return res.json(result.filter(Boolean));
};

export const getHireableCreators = async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
  try {
    const { creatorProfilesTable: cpTable } = await import("@workspace/db/schema");
    const rows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        bio: usersTable.bio,
      })
      .from(cpTable)
      .innerJoin(usersTable, and(eq(usersTable.id, cpTable.userId), eq(usersTable.isDeleted, false), eq(usersTable.isBanned, false), eq(usersTable.showInSearch, true)))
      .where(eq(cpTable.isAvailableForHire, true))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
    return res.json(rows);
  } catch {
    return res.json([]);
  }
};

export const getUserByUsername = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const { username } = req.params;

  const [profileUser] = await (db as any).select().from(usersTable).where(ilike(usersTable.username, username as string));
  if (!profileUser) return res.status(404).json({ error: "User not found" });

  // Non-blocking profile view tracking (never fails the request)
  void (async () => {
    try {
      if (viewerId && viewerId === profileUser.id) return;
      const redis = getRedis();
      const viewerKey = viewerId
        ? `pv:${profileUser.id}:u${viewerId}`
        : `pv:${profileUser.id}:ip${req.ip}`;
      if (redis) {
        const exists = await redis.get(viewerKey);
        if (exists) return;
        await redis.set(viewerKey, "1", { ex: 3600 });
      }
      await db.insert(profileViewsTable).values({
        profileUserId: profileUser.id,
        viewerUserId: viewerId,
      });
    } catch { }
  })();

  const userWithCounts = await getUserWithCounts(profileUser.id, viewerId);
  const workHistory = await db
    .select()
    .from(workHistoryTable)
    .where(eq(workHistoryTable.userId, profileUser.id))
    .orderBy(desc(workHistoryTable.startYear));

  const educationHistory = await db
    .select()
    .from(educationHistoryTable)
    .where(eq(educationHistoryTable.userId, profileUser.id))
    .orderBy(desc(educationHistoryTable.startYear));

  const recentPosts = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.authorId, profileUser.id), eq(postsTable.isPublished, true), visiblePostExpiryCondition(), postVisibilityCondition(viewerId)))
    .orderBy(desc(postsTable.createdAt))
    .limit(6);

  const creatorProfile = await getCreatorProfile(profileUser.id);

  return res.json({
    user: userWithCounts,
    workHistory,
    educationHistory,
    creatorProfile,
    recentPosts: recentPosts.map(p => ({
      ...p,
      author: userWithCounts,
      tags: JSON.parse(p.tags || "[]"),
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
    })),
  });
};

export const getProfileViewers = async (req: Request, res: Response) => {
  const viewerId = (req as any).currentUser.id as number;
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.username,
      u.display_name AS "displayName",
      u.avatar_url AS "avatarUrl",
      pv.viewed_at AS "viewedAt",
      EXISTS (
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ${viewerId}
          AND f.following_id = pv.viewer_user_id
      ) AS "isFollowing"
    FROM profile_views pv
    INNER JOIN users u ON u.id = pv.viewer_user_id
    WHERE pv.profile_user_id = ${viewerId}
      AND pv.viewer_user_id IS NOT NULL
      AND pv.id IN (
        SELECT DISTINCT ON (viewer_user_id) id
        FROM profile_views
        WHERE profile_user_id = ${viewerId}
          AND viewer_user_id IS NOT NULL
        ORDER BY viewer_user_id, viewed_at DESC, id DESC
      )
    ORDER BY pv.viewed_at DESC, pv.id DESC
    LIMIT 20
  `);

  return res.json(result.rows);
};

export const getUserPosts = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const { username } = req.params;
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);

  const [user] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!user) return res.status(404).json({ error: "User not found" });

  const postFilter = and(
    eq(postsTable.authorId, user.id),
    eq(postsTable.isPublished, true),
    eq(postsTable.isDeleted, false),
    visiblePostExpiryCondition(),
    postVisibilityCondition(viewerId),
  );
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(postFilter);
  const posts = await db
    .select()
    .from(postsTable)
    .where(postFilter)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const enriched = await Promise.all(posts.map(p => enrichPost(p, viewerId)));
  const total = Number(countRow?.count ?? 0);
  return res.json({ posts: enriched, total, page, limit, hasMore: page * limit < total });
};

export const followUser = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const { username } = req.params;
  const [target] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!target) return res.status(404).json({ error: "User not found" });

  const existing = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, target.id)));

  let following: boolean;
  if (existing.length > 0) {
    await db
      .delete(followsTable)
      .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, target.id)));
    following = false;
  } else {
    await db.insert(followsTable).values({ followerId: viewerId, followingId: target.id });
    following = true;
    const [follower] = await db.select({ username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, viewerId));
    const followerUsername = follower?.username ?? "Someone";
    const referer = (req.headers.referer || req.headers.referrer || "") as string;
    const postMatch = referer.match(/\/post\/(\d+)/);
    const fromPostId = postMatch ? parseInt(postMatch[1]) : null;
    const followMsg = fromPostId
      ? `@${followerUsername} followed you after reading your post`
      : `@${followerUsername} started following you`;
    const { notify } = await import("../notifications/notification.service");
    await notify({
      userId: target.id,
      actorId: viewerId,
      type: "follow",
      message: followMsg,
      ...(fromPostId ? { postId: fromPostId } : {}),
    });
    const { checkFollowMilestones } = await import("../achievements/achievement.service");
    void checkFollowMilestones(target.id);

    // Fire-and-forget: opportunity nudge at follower milestones
    (async () => {
      try {
        const { notificationsTable: _notifTable, adminLogsTable } = await import("@workspace/db/schema");
        const { eq: _eq, and: _and } = await import("drizzle-orm");
        const [followedUser] = await db
          .select({ id: usersTable.id, followerCount: sql<number>`(SELECT COUNT(*)::int FROM follows WHERE following_id = ${usersTable.id})`, hireMeEnabled: usersTable.hireMeEnabled, displayName: usersTable.displayName })
          .from(usersTable)
          .where(_eq(usersTable.id, target.id));
        if (!followedUser) return;
        const followerCount = Number(followedUser.followerCount ?? 0);
        const MILESTONES = [50, 100, 500, 1000, 5000, 10000];
        for (const milestone of MILESTONES) {
          if (followerCount !== milestone) continue;
          const logKey = `opp_nudge_${followedUser.id}_${milestone}`;
          const existingLog = await db
            .select({ id: adminLogsTable.id })
            .from(adminLogsTable)
            .where(_and(
              _eq(adminLogsTable.targetId, followedUser.id),
              _eq(adminLogsTable.action, logKey),
            ))
            .limit(1);
          if (existingLog.length > 0) break;
          await db.insert(adminLogsTable).values({
            adminId: followedUser.id,
            action: logKey,
            targetType: "user",
            targetId: followedUser.id,
            details: `Opportunity nudge at ${milestone} followers`,
          });
          const hirePrompt = followedUser.hireMeEnabled
            ? ""
            : " Open yourself to opportunities in Settings → Creator Profile.";
          await db.insert(_notifTable).values({
            userId: followedUser.id,
            type: "opportunity_nudge",
            actorId: followedUser.id,
            message: `🎯 You reached ${milestone.toLocaleString()} followers, ${followedUser.displayName}!${hirePrompt}`,
            category: "growth",
          });
          const { getIO } = await import("../../lib/socket");
          const io = getIO();
          io?.to(`user:${followedUser.id}`).emit("notification:new", {
            type: "opportunity_nudge",
            message: `🎯 You hit ${milestone.toLocaleString()} followers!`,
          });
          break;
        }
      } catch { /* never block follow action */ }
    })();
  }

  const [followersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, target.id));

  return res.json({ following, followersCount: followersResult?.count ?? 0 });
};

export const getFollowers = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const { username } = req.params;
  const [user] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!user) return res.status(404).json({ error: "User not found" });

  const followers = await db
    .select({ userId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.id));

  const result = await Promise.all(followers.map(f => getUserWithCounts(f.userId, viewerId)));
  return res.json(result.filter(Boolean));
};

export const getFollowing = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const { username } = req.params;
  const [user] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!user) return res.status(404).json({ error: "User not found" });

  const following = await db
    .select({ userId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id));

  const result = await Promise.all(following.map(f => getUserWithCounts(f.userId, viewerId)));
  return res.json(result.filter(Boolean));
};

export const updateMyProfile = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const [currentUser] = await db
    .select({ username: usersTable.username, lastUsernameChangeAt: usersTable.lastUsernameChangeAt })
    .from(usersTable)
    .where(eq(usersTable.id, viewerId));
  if (!currentUser) return res.status(404).json({ error: "User not found" });

  if (req.body.username !== undefined) {
    const username = String(req.body.username).trim();
    if (username !== currentUser.username) {
      const lastChange = currentUser.lastUsernameChangeAt;
      if (lastChange && Date.now() - new Date(lastChange).getTime() < 14 * 24 * 60 * 60 * 1000) {
        return res.status(429).json({ error: "You can only change your username once every 14 days." });
      }
    }
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return res.status(400).json({ error: "This username is reserved and cannot be used." });
    }
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existing && existing.id !== viewerId) {
      return res.status(409).json({ error: "Username already taken" });
    }
    req.body.username = username;
  }

  const fields = [
    "username", "displayName", "bio", "headline", "avatarUrl", "coverUrl", "website", "location",
    "country", "facebook", "linkedin", "twitter", "instagram",
    "profileVisibility", "showEmail", "showWebsite", "showLocation",
    "identityType",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (typeof updates.username === "string" && updates.username !== currentUser.username) {
    updates.lastUsernameChangeAt = new Date();
  }

  // Users commonly paste domains or handles without a scheme. Store a
  // clickable URL so profile links work consistently everywhere.
  for (const field of ["website", "facebook", "linkedin", "twitter", "instagram"]) {
    const value = updates[field];
    if (typeof value === "string" && value.trim() && !/^https?:\/\//i.test(value.trim())) {
      updates[field] = `https://${value.trim()}`;
    }
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, viewerId));
  await invalidateUserCache(viewerId);
  const user = await getUserWithCounts(viewerId, null);
  return res.json(user);
};

// ─── Work History CRUD ───────────────────────────────────────────────────────

export const getMyWorkHistory = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const entries = await db
    .select()
    .from(workHistoryTable)
    .where(eq(workHistoryTable.userId, viewerId))
    .orderBy(desc(workHistoryTable.startYear));
  return res.json(entries);
};

export const addWorkHistory = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { title, organization, startYear, endYear, description } = req.body;
  const [entry] = await db
    .insert(workHistoryTable)
    .values({ userId: viewerId, title, organization, startYear, endYear: endYear ?? null, description: description ?? null })
    .returning();
  return res.status(201).json(entry);
};

export const updateWorkHistory = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const [entry] = await db.select().from(workHistoryTable).where(eq(workHistoryTable.id, id));
  if (!entry || entry.userId !== viewerId) return res.status(404).json({ error: "Not found" });
  const updates: Record<string, unknown> = {};
  for (const field of ["title", "organization", "startYear", "endYear", "description"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const [updated] = await db.update(workHistoryTable).set(updates).where(eq(workHistoryTable.id, id)).returning();
  return res.json(updated);
};

export const deleteWorkHistory = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const [entry] = await db.select().from(workHistoryTable).where(eq(workHistoryTable.id, id));
  if (!entry || entry.userId !== viewerId) return res.status(404).json({ error: "Not found" });
  await db.delete(workHistoryTable).where(eq(workHistoryTable.id, id));
  return res.json({ success: true });
};

// ─── Education History CRUD ──────────────────────────────────────────────────

export const getMyEducation = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const entries = await db
    .select()
    .from(educationHistoryTable)
    .where(eq(educationHistoryTable.userId, viewerId))
    .orderBy(desc(educationHistoryTable.startYear));
  return res.json(entries);
};

export const addEducation = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { school, degree, field, startYear, endYear, description } = req.body;
  const [entry] = await db
    .insert(educationHistoryTable)
    .values({ userId: viewerId, school, degree, field: field ?? null, startYear, endYear: endYear ?? null, description: description ?? null })
    .returning();
  return res.status(201).json(entry);
};

export const updateEducation = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const [entry] = await db.select().from(educationHistoryTable).where(eq(educationHistoryTable.id, id));
  if (!entry || entry.userId !== viewerId) return res.status(404).json({ error: "Not found" });
  const updates: Record<string, unknown> = {};
  for (const field of ["school", "degree", "field", "startYear", "endYear", "description"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const [updated] = await db.update(educationHistoryTable).set(updates).where(eq(educationHistoryTable.id, id)).returning();
  return res.json(updated);
};

export const deleteEducation = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const [entry] = await db.select().from(educationHistoryTable).where(eq(educationHistoryTable.id, id));
  if (!entry || entry.userId !== viewerId) return res.status(404).json({ error: "Not found" });
  await db.delete(educationHistoryTable).where(eq(educationHistoryTable.id, id));
  return res.json({ success: true });
};

export const updateMyCreatorProfile = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const { skills, links, isAvailableForHire, availableFor } = req.body;
  const profile = await upsertCreatorProfile(viewerId, { skills, links, isAvailableForHire, availableFor });
  return res.json(profile);
};

export const getCreatorProfileByUsername = async (req: Request, res: Response) => {
  const { username } = req.params;
  const [user] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!user) return res.status(404).json({ error: "User not found" });

  const profile = await getCreatorProfile(user.id);
  return res.json(profile || { userId: user.id, skills: [], links: [], verified: false, isAvailableForHire: false, availableFor: [] });
};

export const completeOnboarding = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body.username !== undefined) {
    const username = String(req.body.username).trim();
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return res.status(400).json({ error: "This username is reserved and cannot be used." });
    }
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existing && existing.id !== viewerId) {
      return res.status(409).json({ error: "Username already taken" });
    }
    updates.username = username;
  }
  if (req.body.displayName !== undefined) updates.displayName = String(req.body.displayName).trim();
  if (typeof req.body.onboardingComplete === "boolean") updates.onboardingComplete = req.body.onboardingComplete;
  if (Array.isArray(req.body.onboardingGoals)) {
    updates.onboardingGoals = JSON.stringify(req.body.onboardingGoals.slice(0, 10));
  }
  await db.update(usersTable).set(updates as any).where(eq(usersTable.id, viewerId));
  await invalidateUserCache(viewerId);
  const user = await getUserWithCounts(viewerId, null);

  // Fire-and-forget: pre-seed topic affinity from selected interests
  const interests: string[] = Array.isArray(req.body.interests)
    ? req.body.interests
    : Array.isArray(req.body.onboardingGoals)
      ? req.body.onboardingGoals
      : [];
  if (interests.length > 0) {
    const newUserId = viewerId;
    (async () => {
      try {
        const { db: _db } = await import("@workspace/db");
        const { userTopicAffinityTable, topicsTable } = await import("@workspace/db/schema");
        const { inArray: _inArray } = await import("drizzle-orm");
        const topics = await _db
          .select({ id: topicsTable.id, slug: topicsTable.slug })
          .from(topicsTable)
          .where(_inArray(topicsTable.slug, interests.map(i => i.toLowerCase())));
        for (const topic of topics) {
          await _db.insert(userTopicAffinityTable)
            .values({
              userId: newUserId,
              topicId: topic.id,
              affinityScore: 0.5,
              viewCount: 0,
              readDepthTotal: 0,
              likeCount: 0,
              commentCount: 0,
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        }
      } catch { /* never block onboarding completion */ }
    })();
  }

  return res.json(user);
};

export const updateSettings = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const allowed: Record<string, boolean> = {};
  if (typeof req.body.emailDigestEnabled === "boolean") allowed.emailDigestEnabled = req.body.emailDigestEnabled;
  if (typeof req.body.topicNotificationEnabled === "boolean") allowed.topicNotificationEnabled = req.body.topicNotificationEnabled;
  if (typeof req.body.hireMeEnabled === "boolean") allowed.hireMeEnabled = req.body.hireMeEnabled;
  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: "No valid settings provided" });
  await db.update(usersTable).set({ ...allowed, updatedAt: new Date() }).where(eq(usersTable.id, viewerId));
  const user = await getUserWithCounts(viewerId, null);
  return res.json(user);
};

export const requestVerification = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const kind = req.body?.kind === "phone" ? "phone" : req.body?.kind === "identity" ? "identity" : null;
  if (!kind) return res.status(400).json({ error: "kind must be phone or identity" });

  const { isFeatureEnabled } = await import("../../lib/featureFlags");
  const flag = kind === "phone" ? "phone_verification_enabled" : "identity_verification_enabled";
  if (!(await isFeatureEnabled(flag))) {
    return res.status(403).json({ error: `${kind}_verification_disabled`, message: "This verification option is not enabled." });
  }
  const providerConfigured = kind === "phone"
    ? Boolean(process.env.SMS_PROVIDER_API_KEY)
    : Boolean(process.env.IDENTITY_VERIFICATION_PROVIDER_KEY);
  if (!providerConfigured) {
    return res.status(503).json({ error: "verification_not_configured", message: "Verification is enabled but its provider is not configured yet." });
  }
  return res.status(501).json({ error: "verification_provider_unavailable", message: "The configured verification provider is not available yet." });
};

export const toggleCreatorMode = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { isCreatorMode } = req.body;
  await db.update(usersTable).set({ isCreatorMode: Boolean(isCreatorMode), updatedAt: new Date() }).where(eq(usersTable.id, viewerId));
  const user = await getUserWithCounts(viewerId, null);
  return res.json(user);
};

export const getMySavedPosts = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const savedRows = await db
    .select({ postId: savedPostsTable.postId })
    .from(savedPostsTable)
    .innerJoin(postsTable, eq(savedPostsTable.postId, postsTable.id))
    .where(and(eq(savedPostsTable.userId, viewerId), eq(postsTable.isDeleted, false), visiblePostExpiryCondition(), postVisibilityCondition(viewerId)))
    .orderBy(desc(savedPostsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(savedPostsTable)
    .innerJoin(postsTable, eq(savedPostsTable.postId, postsTable.id))
    .where(and(eq(savedPostsTable.userId, viewerId), eq(postsTable.isDeleted, false), visiblePostExpiryCondition(), postVisibilityCondition(viewerId)));

  const postIds = savedRows.map(r => r.postId);
  const total = Number(totalRow?.count ?? 0);
  if (postIds.length === 0) return res.json({ posts: [], total, page, limit, hasMore: false });

  const posts = await db
    .select()
    .from(postsTable)
    .where(and(inArray(postsTable.id, postIds), eq(postsTable.isDeleted, false)));

  const enrichedPosts = await Promise.all(posts.map(p => enrichPost(p, viewerId)));
  const enrichedById = new Map(enrichedPosts.map(post => [post.id, post]));
  const orderedPosts = postIds.flatMap(postId => {
    const post = enrichedById.get(postId);
    return post ? [post] : [];
  });
  return res.json({ posts: orderedPosts, total, page, limit, hasMore: page * limit < total });
};

export const getUserPortfolio = async (req: Request, res: Response) => {
  const { username } = req.params;
  const [user] = await (db as any).select().from(usersTable).where(eq(usersTable.username, username as string));
  if (!user) return res.status(404).json({ error: "User not found" });

  const featured = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      type: postsTable.type,
      excerpt: postsTable.excerpt,
      imageUrl: postsTable.imageUrl,
      createdAt: postsTable.createdAt,
      likeCount: (postsTable as any).likeCount,
    })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, user.id), eq(postsTable.isPublished, true), eq(postsTable.isDeleted, false), visiblePostExpiryCondition(), postVisibilityCondition(null)))
    .orderBy(desc((postsTable as any).likeCount), desc(postsTable.createdAt))
    .limit(6);

  const counts = await getUserWithCounts(user.id, null);

  const safeUser: Record<string, unknown> = {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    bio: user.bio,
    headline: user.headline,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    website: user.website,
    twitter: user.twitter,
    linkedin: user.linkedin,
    instagram: user.instagram,
    facebook: user.facebook,
    location: user.location,
    country: user.country,
    hireMeEnabled: user.hireMeEnabled,
    showEmail: user.showEmail,
    identityType: user.identityType ?? null,
    isPremium: user.isPremium,
    isCreatorMode: user.isCreatorMode,
  };
  if (user.showEmail) safeUser.email = user.email;

  return res.json({
    user: safeUser,
    featuredPosts: featured.map(p => ({ ...p, tags: [] })),
    stats: {
      postCount: counts?.postsCount ?? 0,
      followerCount: counts?.followersCount ?? 0,
    },
  });
};

export const getProfileStrength = async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const { getSessionUserId } = await import("../../lib/auth");
  const userId = getSessionUserId(auth.slice(7));
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return res.status(404).json({ error: "User not found" });

  const {
    portfolioItemsTable,
    skillEndorsementsTable,
    creatorProfilesTable,
    serviceListingsTable,
  } = await import("@workspace/db/schema");
  const { count: drizzleCount } = await import("drizzle-orm");

  const [portfolioRow, endorsementRow, creatorRow, servicesRow] = await Promise.all([
    db.select({ count: drizzleCount() }).from(portfolioItemsTable).where(eq(portfolioItemsTable.userId, userId)),
    db.select({ count: drizzleCount() }).from(skillEndorsementsTable).where(eq(skillEndorsementsTable.toUserId, userId)),
    db.select({ skills: creatorProfilesTable.skills, links: creatorProfilesTable.links, isAvailableForHire: creatorProfilesTable.isAvailableForHire })
      .from(creatorProfilesTable).where(eq(creatorProfilesTable.userId, userId)).limit(1),
    db.select({ count: drizzleCount() }).from(serviceListingsTable)
      .where(and(eq(serviceListingsTable.creatorId, userId), eq(serviceListingsTable.isActive, true))),
  ]);

  const portfolioCount = Number(portfolioRow[0]?.count ?? 0);
  const endorsementCount = Number(endorsementRow[0]?.count ?? 0);
  const servicesCount = Number(servicesRow[0]?.count ?? 0);
  const creatorProfile = creatorRow[0] ?? null;
  let skills: string[] = [];
  let creatorLinks: unknown[] = [];
  try { skills = JSON.parse(creatorProfile?.skills || "[]"); } catch { /* */ }
  try { creatorLinks = JSON.parse((creatorProfile as any)?.links || "[]"); } catch { /* */ }

  const hasSocial = !!(user.twitter || user.linkedin || user.instagram || user.facebook);

  const items = [
    { label: "Profile photo", key: "avatar", done: !!user.avatarUrl, points: 15, category: "basics", tip: "Add a photo so people can put a face to your name.", actionUrl: "/settings" },
    { label: "Bio", key: "bio", done: !!(user.bio && (user.bio as string).length > 20), points: 15, category: "basics", tip: "Write a short bio that tells your story.", actionUrl: "/settings" },
    { label: "Headline", key: "headline", done: !!(user.headline), points: 15, category: "basics", tip: "Add a professional headline like 'Fiction writer & storyteller'.", actionUrl: "/settings" },
    { label: "Cover image", key: "cover", done: !!(user.coverUrl), points: 10, category: "branding", tip: "Set a cover image to make your profile stand out.", actionUrl: "/settings" },
    { label: "Website link", key: "website", done: !!(user.website), points: 10, category: "branding", tip: "Link to your portfolio, blog, or personal site.", actionUrl: "/settings" },
    { label: "Location", key: "location", done: !!(user.location), points: 5, category: "basics", tip: "Add your city or country to attract local opportunities.", actionUrl: "/settings" },
    { label: "Social links", key: "social", done: hasSocial, points: 10, category: "social", tip: "Connect at least one social account (Twitter, LinkedIn, Instagram, Facebook).", actionUrl: "/settings" },
    { label: "Portfolio item", key: "portfolio", done: portfolioCount >= 1, points: 10, category: "work", tip: "Add at least one portfolio piece to showcase your best work.", actionUrl: "/profile/" + user.username },
    { label: "Creator skills", key: "skills", done: skills.length >= 2, points: 5, category: "work", tip: "List your skills so collaborators can find you.", actionUrl: "/profile/" + user.username },
    { label: "Open for hire", key: "hire", done: !!(user.hireMeEnabled), points: 3, category: "opportunities", tip: "Toggle 'Open for Hire' so clients know you're available.", actionUrl: "/settings" },
    { label: "Skill endorsement", key: "endorsed", done: endorsementCount >= 1, points: 5, category: "social", tip: "Get endorsed by a peer - collaborate and ask for endorsements.", actionUrl: "/profile/" + user.username },
    { label: "Service listing", key: "service", done: servicesCount >= 1, points: 5, category: "opportunities", tip: "Add a service to unlock income and booking opportunities.", actionUrl: "/profile/" + user.username },
    { label: "Creator links", key: "links", done: creatorLinks.length >= 1, points: 2, category: "branding", tip: "Add links to your external work, Gumroad, Patreon, or newsletter.", actionUrl: "/profile/" + user.username },
  ] as const;

  const totalPoints = items.reduce((s, i) => s + i.points, 0);
  const earnedPoints = items.filter(i => i.done).reduce((s, i) => s + i.points, 0);
  const score = Math.round((earnedPoints / totalPoints) * 100);

  const level = score >= 90 ? "elite" : score >= 70 ? "strong" : score >= 45 ? "growing" : "starter";
  const levelLabel = { elite: "Elite Profile", strong: "Strong Profile", growing: "Growing", starter: "Getting Started" }[level];

  return res.json({
    score,
    earnedPoints,
    totalPoints,
    level,
    levelLabel,
    items,
    missing: items.filter(i => !i.done).sort((a, b) => b.points - a.points),
    completed: items.filter(i => i.done),
  });
};
