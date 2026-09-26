import { Request, Response } from "express";
import { getSessionUserId } from "../../lib/auth";
import * as GalleryService from "./gallery.service";

function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export const getPortfolioItems = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
  const items = await GalleryService.getPortfolioItems(userId, viewerId);
  return res.json({ items });
};

export const addPortfolioItem = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { title, description, mediaUrl, category, visibility } = req.body;
  if (!title || !mediaUrl) return res.status(400).json({ error: "Title and mediaUrl are required" });
  const item = await GalleryService.addPortfolioItem(viewerId, { title, description, mediaUrl, category, visibility });
  return res.status(201).json(item);
};

export const updatePortfolioItem = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { title, description, mediaUrl, category, visibility } = req.body;
  if (!title || !mediaUrl) return res.status(400).json({ error: "Title and mediaUrl are required" });
  try {
    const item = await GalleryService.updatePortfolioItem(id, viewerId, { title, description, mediaUrl, category, visibility });
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
