import { Request, Response } from "express";
import { getSessionUserId } from "../../lib/auth";
import * as GalleryService from "./gallery.service";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { canViewProfile } from "../profiles/profileAccess.service";

function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export const getPortfolioItems = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
  const [user] = await db.select({
    id: usersTable.id,
    profileVisibility: usersTable.profileVisibility,
    isDeleted: usersTable.isDeleted,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.isDeleted || !(await canViewProfile(user, viewerId))) return res.status(404).json({ error: "User not found" });
  const items = await GalleryService.getPortfolioItems(userId, viewerId);
  return res.json({ items: items.map(item => ({
    ...item,
    evidenceStatus: item.evidenceUrl ? "evidence_attached" : "self_reported",
    evidenceUrl: viewerId === userId ? item.evidenceUrl : null,
  })) });
};

export const addPortfolioItem = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { title, description, mediaUrl, evidenceUrl, category, visibility } = req.body;
  if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof mediaUrl !== "string" || !mediaUrl.trim() || mediaUrl.length > 2048) {
    return res.status(400).json({ error: "Title (1-200 characters) and mediaUrl (1-2048 characters) are required" });
  }
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) return res.status(400).json({ error: "Description must be 2,000 characters or fewer" });
  if (typeof evidenceUrl !== "undefined" && (typeof evidenceUrl !== "string" || evidenceUrl.length > 2048)) return res.status(400).json({ error: "evidenceUrl must be at most 2,048 characters" });
  if (category !== undefined && (typeof category !== "string" || category.length > 80)) return res.status(400).json({ error: "Category must be 80 characters or fewer" });
  if (visibility !== undefined && !["public", "private", "followers"].includes(visibility)) return res.status(400).json({ error: "Invalid portfolio visibility" });
  const item = await GalleryService.addPortfolioItem(viewerId, { title: title.trim(), description, mediaUrl: mediaUrl.trim(), evidenceUrl: evidenceUrl?.trim(), category, visibility });
  return res.status(201).json(item);
};

export const updatePortfolioItem = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { title, description, mediaUrl, evidenceUrl, category, visibility } = req.body;
  if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof mediaUrl !== "string" || !mediaUrl.trim() || mediaUrl.length > 2048) {
    return res.status(400).json({ error: "Title (1-200 characters) and mediaUrl (1-2048 characters) are required" });
  }
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) return res.status(400).json({ error: "Description must be 2,000 characters or fewer" });
  if (typeof evidenceUrl !== "undefined" && (typeof evidenceUrl !== "string" || evidenceUrl.length > 2048)) return res.status(400).json({ error: "evidenceUrl must be at most 2,048 characters" });
  if (category !== undefined && (typeof category !== "string" || category.length > 80)) return res.status(400).json({ error: "Category must be 80 characters or fewer" });
  if (visibility !== undefined && !["public", "private", "followers"].includes(visibility)) return res.status(400).json({ error: "Invalid portfolio visibility" });
  try {
    const item = await GalleryService.updatePortfolioItem(id, viewerId, { title: title.trim(), description, mediaUrl: mediaUrl.trim(), evidenceUrl: evidenceUrl?.trim(), category, visibility });
    if (!item) return res.status(404).json({ error: "Item not found" });
    return res.json(item);
  } catch (e: any) {
    if (e.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw e;
  }
};

export const deletePortfolioItem = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const result = await GalleryService.deletePortfolioItem(id, viewerId);
    if (!result) return res.status(404).json({ error: "Item not found" });
    return res.json({ success: true });
  } catch (e: any) {
    if (e.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw e;
  }
};
