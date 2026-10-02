import { createHash, createHmac, randomBytes, timingSafeEqual, scryptSync } from "crypto";
import { db } from "@workspace/db";
import { revokedTokensTable, sessionsTable, usersTable } from "@workspace/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/** Returns true if the stored hash should be upgraded to scrypt. */
export function isLegacyPasswordHash(storedHash: string): boolean {
  return !storedHash.startsWith("scrypt:");
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (storedHash.startsWith("scrypt:")) {
      const parts = storedHash.slice("scrypt:".length).split(":");
      if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
      const salt = Buffer.from(parts[0], "hex");
      const expected = Buffer.from(parts[1], "hex");
      const actual = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
      return timingSafeEqual(actual, expected);
    }
    // Legacy SHA-256 fallback - after verifying, caller should upgrade hash
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const testHash = createHash("sha256").update(password + salt).digest("hex");
    const testBuf = Buffer.from(testHash, "hex");
    const hashBuf = Buffer.from(hash, "hex");
    if (testBuf.length !== hashBuf.length) return false;
    return timingSafeEqual(testBuf, hashBuf);
  } catch {
    return false;
  }
}

type TokenType = "access" | "refresh";

type TokenPayload = {
  sub: number;
  ver?: number;
  typ: TokenType;
  iat: number;
  exp: number;
  jti: string;
};

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
  }
  return "quillhive-development-jwt-secret-change-before-production";
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function sign(header: string, payload: string): string {
  return createHmac("sha256", getJwtSecret()).update(`${header}.${payload}`).digest("base64url");
}

function hashJti(jti: string): string {
  return createHash("sha256").update(jti).digest("hex");
}

function createJwt(userId: number, type: TokenType, ttlSeconds: number, authVersion = 0): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: userId,
    ver: authVersion,
    typ: type,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomBytes(16).toString("hex"),
  } satisfies TokenPayload));
  return `${header}.${payload}.${sign(header, payload)}`;
}

function verifyJwtSync(token: string, expectedType: TokenType): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expectedSignature = sign(header, payload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    if (decoded.typ !== expectedType) return null;
    if (!Number.isInteger(decoded.sub) || decoded.sub <= 0) return null;
    if (!Number.isInteger(decoded.exp) || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function createSession(userId: number): string {
  return createJwt(userId, "access", ACCESS_TOKEN_TTL_SECONDS);
}

export async function createAuthTokens(userId: number, meta?: { userAgent?: string; ipHash?: string }) {
  const [user] = await db.select({ authVersion: usersTable.authVersion }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new Error("Cannot create auth tokens for a missing user");
  const accessToken = createJwt(userId, "access", ACCESS_TOKEN_TTL_SECONDS, user.authVersion);
  const refreshToken = createJwt(userId, "refresh", REFRESH_TOKEN_TTL_SECONDS, user.authVersion);

  const refreshPayload = verifyJwtSync(refreshToken, "refresh");
  if (refreshPayload) {
    const tokenHash = hashJti(refreshPayload.jti);
    const expiresAt = new Date(refreshPayload.exp * 1000);
    await db.insert(sessionsTable).values({
      userId,
      tokenHash,
      userAgent: meta?.userAgent ?? null,
      ipHash: meta?.ipHash ?? null,
      expiresAt,
    }).onConflictDoNothing();
  }

  return {
    token: accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  };
}

export async function refreshSession(refreshToken: string, meta?: { userAgent?: string; ipHash?: string }) {
  const payload = verifyJwtSync(refreshToken, "refresh");
  if (!payload) return null;

  const [user] = await db.select({ authVersion: usersTable.authVersion }).from(usersTable).where(eq(usersTable.id, payload.sub));
  if (!user || (payload.ver ?? 0) !== user.authVersion) return null;

  const tokenHash = hashJti(payload.jti);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
  if (!session) return null;

  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));

  return createAuthTokens(payload.sub, meta);
}

export async function destroySession(token: string): Promise<void> {
  const refreshPayload = verifyJwtSync(token, "refresh");
  if (refreshPayload) {
    const tokenHash = hashJti(refreshPayload.jti);
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
  }
}

export function getSessionUserId(token: string): number | null {
  return verifyJwtSync(token, "access")?.sub ?? null;
}

export function getSessionAuthVersion(token: string): number | null {
  const payload = verifyJwtSync(token, "access");
  return payload ? payload.ver ?? 0 : null;
}

export async function blacklistToken(token: string): Promise<void> {
  const payload = verifyJwtSync(token, "access");
  if (!payload) return;
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return;

  const key = `bl:${hashJti(payload.jti)}`;
  await db.delete(revokedTokensTable).where(lt(revokedTokensTable.expiresAt, new Date()));
  await db.insert(revokedTokensTable).values({
    tokenHash: key,
    expiresAt: new Date(payload.exp * 1000),
  }).onConflictDoNothing();
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const payload = verifyJwtSync(token, "access");
  if (!payload) return false;

  const key = `bl:${hashJti(payload.jti)}`;
  try {
    const [revoked] = await db.select({ id: revokedTokensTable.id })
      .from(revokedTokensTable)
      .where(and(eq(revokedTokensTable.tokenHash, key), gt(revokedTokensTable.expiresAt, new Date())));
    return !!revoked;
  } catch {
    return true;
  }
}
