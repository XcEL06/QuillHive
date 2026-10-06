import { Request, Response } from "express";
import { getSessionUserId } from "../../lib/auth";
import * as CollaborationService from "./collaboration.service";

function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export const sendRequest = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { receiverId, message } = req.body;
  if (!receiverId || !message) return res.status(400).json({ error: "receiverId and message are required" });
  if (Number(receiverId) === viewerId) return res.status(400).json({ error: "Cannot send request to yourself" });

  const result = await CollaborationService.sendCollaborationRequest(viewerId, Number(receiverId), message);
  return res.status(result.duplicate ? 200 : 201).json(result);
};

export const getReceivedRequests = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const requests = await CollaborationService.getReceivedRequests(viewerId);
  return res.json(requests);
};

export const getSentRequests = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const requests = await CollaborationService.getSentRequests(viewerId);
  return res.json(requests);
};

export const updateRequest = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.requestId);
  const { status } = req.body;
  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ error: "status must be accepted or rejected" });
  }
  try {
    const result = await CollaborationService.updateRequestStatus(id, viewerId, status);
    if (!result) return res.status(404).json({ error: "Request not found" });
    return res.json(result);
  } catch (e: any) {
    if (e.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw e;
  }
};

export const getRooms = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  return res.json(await CollaborationService.getRooms(viewerId));
};

export const createRoom = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { requestId, title, brief, splitSuggestion } = req.body;
  if (!Number.isInteger(requestId) || !title?.trim()) return res.status(400).json({ error: "requestId and title are required" });
  const result = await CollaborationService.createRoom(viewerId, { requestId, title: title.trim(), brief, splitSuggestion });
  if (result.kind === "missing") return res.status(404).json({ error: "Accepted collaboration request not found" });
  if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
  return res.status(result.kind === "created" ? 201 : 200).json(result.room);
};

export const updateRoom = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const result = await CollaborationService.updateRoom(viewerId, parseInt(req.params.roomId), req.body);
  if (result.kind === "missing") return res.status(404).json({ error: "Room not found" });
  if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
  return res.json(result.room);
};
