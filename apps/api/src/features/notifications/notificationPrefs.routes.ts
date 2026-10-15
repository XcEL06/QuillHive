import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";

interface AuthedReq extends Request {
  currentUser: { id: number };
}

export const notificationPrefsRouter = Router();

const channelSchema = z.object({
  inApp: z.boolean(),
  push: z.boolean(),
  email: z.boolean(),
});

const updatePrefsSchema = z.record(z.string(), channelSchema);

const DEFAULT_PREFS: Record<string, { inApp: boolean; push: boolean; email: boolean }> = {
  like: { inApp: true, push: false, email: false },
  comment: { inApp: true, push: true, email: false },
  comment_like: { inApp: true, push: false, email: false },
  reply: { inApp: true, push: true, email: false },
  follow: { inApp: true, push: true, email: false },
  mention: { inApp: true, push: true, email: true },
  poll_vote: { inApp: true, push: false, email: false },
  appreciation: { inApp: true, push: false, email: false },
  share: { inApp: true, push: false, email: false },
  highlight: { inApp: true, push: true, email: false },
  system: { inApp: true, push: true, email: true },
  birthday: { inApp: true, push: false, email: false },
  admin_action: { inApp: true, push: true, email: true },
  group_invite: { inApp: true, push: true, email: true },
  milestone: { inApp: true, push: true, email: true },
  trending: { inApp: true, push: true, email: false },
  referral_reward: { inApp: true, push: true, email: true },
  achievement: { inApp: true, push: true, email: true },
  streak_milestone: { inApp: true, push: true, email: true },
  opportunity_nudge: { inApp: true, push: true, email: true },
  library_save: { inApp: true, push: false, email: false },
  library_feature: { inApp: true, push: true, email: true },
  library_entry: { inApp: true, push: false, email: false },
  commission_request: { inApp: true, push: true, email: true },
  commission_response: { inApp: true, push: true, email: true },
  skill_endorsement: { inApp: true, push: false, email: false },
  collaboration_accepted: { inApp: true, push: true, email: true },
  collaboration_declined: { inApp: true, push: true, email: false },
  post_approved: { inApp: true, push: true, email: false },
  post_rejected: { inApp: true, push: true, email: true },
  digest: { inApp: false, push: false, email: true },
};

notificationPrefsRouter.get("/preferences", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedReq).currentUser.id;
  const [user] = await db
    .select({ notificationPrefs: usersTable.notificationPrefs })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const saved = (user?.notificationPrefs ?? {}) as Record<string, { inApp: boolean; push: boolean; email: boolean }>;
  const merged: Record<string, { inApp: boolean; push: boolean; email: boolean }> = { ...DEFAULT_PREFS };
  for (const [type, pref] of Object.entries(saved)) {
    if (type in merged) merged[type] = pref;
  }
  return res.json({ preferences: merged, defaults: DEFAULT_PREFS });
});

notificationPrefsRouter.patch("/preferences", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedReq).currentUser.id;
  const parsed = updatePrefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_prefs", issues: parsed.error.issues });

  const [user] = await db
    .select({ notificationPrefs: usersTable.notificationPrefs })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const existing = (user?.notificationPrefs ?? {}) as Record<string, { inApp: boolean; push: boolean; email: boolean }>;
  const updated = { ...existing, ...parsed.data };

  await db.update(usersTable).set({ notificationPrefs: updated }).where(eq(usersTable.id, userId));
  return res.json({ ok: true, prefs: updated });
});

notificationPrefsRouter.post("/preferences/reset", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedReq).currentUser.id;
  await db.update(usersTable).set({ notificationPrefs: DEFAULT_PREFS }).where(eq(usersTable.id, userId));
  return res.json({ ok: true, prefs: DEFAULT_PREFS });
});

export { DEFAULT_PREFS };
