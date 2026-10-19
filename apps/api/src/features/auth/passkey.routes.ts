import { Router, type Response } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { passkeysTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";
import { getUserAccountBanStatus, temporaryRestrictionResponse } from "../../lib/accountRestriction";

export const passkeyRouter = Router();

const challenges = new Map<string, { challenge: string; expiresAt: number; userId?: number; type: "register" | "authenticate" }>();

function newChallenge(userId: number | undefined, type: "register" | "authenticate") {
  const challenge = randomBytes(32).toString("base64url");
  const id = randomBytes(16).toString("base64url");
  challenges.set(id, { challenge, expiresAt: Date.now() + 5 * 60_000, userId, type });
  setTimeout(() => challenges.delete(id), 5 * 60_000).unref?.();
  return { id, challenge };
}

function rpId(): string {
  return process.env.PASSKEY_RP_ID || "localhost";
}
function rpName(): string {
  return process.env.BRAND_NAME || "QuillHive";
}

passkeyRouter.get("/registration-options", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { id, challenge } = newChallenge(userId, "register");
  return res.json({
    challengeId: id,
    publicKeyOptions: {
      rp: { name: rpName(), id: rpId() },
      user: { id: String(userId), name: `user-${userId}`, displayName: `User ${userId}` },
      challenge,
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    },
  });
});

passkeyRouter.post("/register", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { challengeId, credentialId, publicKey, transports, deviceName } = req.body ?? {};
  if (!challengeId || !credentialId || !publicKey) {
    return res.status(400).json({ error: "challengeId, credentialId and publicKey are required" });
  }
  const c = challenges.get(challengeId);
  if (!c || c.type !== "register" || c.userId !== userId || c.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired challenge" });
  }
  challenges.delete(challengeId);

  const [existing] = await db.select().from(passkeysTable).where(eq(passkeysTable.credentialId, credentialId));
  if (existing) return res.status(409).json({ error: "Credential already registered" });

  const [created] = await db.insert(passkeysTable).values({
    userId,
    credentialId: String(credentialId),
    publicKey: String(publicKey),
    transports: transports ? JSON.stringify(transports) : null,
    deviceName: deviceName ? String(deviceName).slice(0, 80) : null,
  }).returning();
  return res.status(201).json({ ok: true, passkey: { id: created.id, deviceName: created.deviceName, createdAt: created.createdAt } });
});

passkeyRouter.get("/authentication-options", async (_req, res: Response) => {
  const { id, challenge } = newChallenge(undefined, "authenticate");
  return res.json({
    challengeId: id,
    publicKeyOptions: {
      challenge,
      timeout: 60000,
      rpId: rpId(),
      userVerification: "preferred",
    },
  });
});

passkeyRouter.post("/authenticate", async (req, res: Response) => {
  const { challengeId, credentialId } = req.body ?? {};
  if (!challengeId || !credentialId) return res.status(400).json({ error: "challengeId and credentialId required" });
  const c = challenges.get(challengeId);
  if (!c || c.type !== "authenticate" || c.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired challenge" });
  }
  challenges.delete(challengeId);

  const [pk] = await db.select().from(passkeysTable).where(eq(passkeysTable.credentialId, String(credentialId)));
  if (!pk) return res.status(404).json({ error: "Unknown credential" });

  const banStatus = await getUserAccountBanStatus(pk.userId);
  if (banStatus?.kind === "temporary") return res.status(403).json(temporaryRestrictionResponse(banStatus.until, banStatus.reason));
  if (banStatus?.kind === "permanent") return res.status(403).json({ error: "Account banned", reason: banStatus.reason });

  await db.update(passkeysTable).set({ lastUsedAt: new Date(), counter: (pk.counter ?? 0) + 1 }).where(eq(passkeysTable.id, pk.id));

  const { createAuthTokens } = await import("../../lib/auth");
  const tokens = await createAuthTokens(pk.userId, { userAgent: (req.headers["user-agent"] || "").slice(0, 200) });
  return res.json({ ok: true, userId: pk.userId, ...tokens });
});

passkeyRouter.get("/", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const rows = await db.select({
    id: passkeysTable.id,
    deviceName: passkeysTable.deviceName,
    createdAt: passkeysTable.createdAt,
    lastUsedAt: passkeysTable.lastUsedAt,
  })
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId))
    .orderBy(desc(passkeysTable.createdAt));
  return res.json({ passkeys: rows });
});

passkeyRouter.delete("/:id", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(passkeysTable).where(and(eq(passkeysTable.id, id), eq(passkeysTable.userId, userId)));
  return res.json({ ok: true });
});
