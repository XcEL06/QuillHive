import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";
import { invalidateUserCache } from "./profile.service";

export const privacyRouter = Router();

const ALLOWED_VISIBILITY = new Set(["public", "private", "followers"]);

privacyRouter.get("/", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [u] = await db.select({
    profileVisibility: usersTable.profileVisibility,
    showEmail: usersTable.showEmail,
    showWebsite: usersTable.showWebsite,
    showLocation: usersTable.showLocation,
    showPostsToEveryone: usersTable.showPostsToEveryone,
    allowMessagesFromAnyone: usersTable.allowMessagesFromAnyone,
    showInSearch: usersTable.showInSearch,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!u) return res.status(404).json({ error: "User not found" });
  return res.json(u);
});

privacyRouter.patch("/", async (req, res: Response) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const body = req.body ?? {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.profileVisibility === "string" && ALLOWED_VISIBILITY.has(body.profileVisibility)) {
    updates.profileVisibility = body.profileVisibility;
  }
  for (const k of ["showEmail", "showWebsite", "showLocation", "showPostsToEveryone", "allowMessagesFromAnyone", "showInSearch"] as const) {
    if (typeof body[k] === "boolean") updates[k] = body[k];
  }
  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: "No valid fields to update" });
  }
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning({
    profileVisibility: usersTable.profileVisibility,
    showEmail: usersTable.showEmail,
    showWebsite: usersTable.showWebsite,
    showLocation: usersTable.showLocation,
    showPostsToEveryone: usersTable.showPostsToEveryone,
    allowMessagesFromAnyone: usersTable.allowMessagesFromAnyone,
    showInSearch: usersTable.showInSearch,
  });
  await invalidateUserCache(userId);
  return res.json(updated);
});
