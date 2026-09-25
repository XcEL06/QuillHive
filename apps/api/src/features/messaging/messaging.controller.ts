import { Request, Response } from "express";
import { getSessionUserId } from "../../lib/auth";
import * as MessagingService from "./messaging.service";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export const getConversations = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const conversations = await MessagingService.getConversations(viewerId);
  return res.json(conversations);
};

export const startConversation = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { userId: targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: "userId is required" });
  const targetId = Number(targetUserId);

  // Enforce allowMessagesFromAnyone privacy setting
  const [target] = await db
    .select({ allowMessagesFromAnyone: usersTable.allowMessagesFromAnyone })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (target && !target.allowMessagesFromAnyone) {
    const [isFollowing] = await db
      .select({ id: followsTable.followerId })
      .from(followsTable)
      .where(and(eq(followsTable.followerId, targetId), eq(followsTable.followingId, viewerId)));
    if (!isFollowing) {
      return res.status(403).json({ error: "This creator only accepts messages from people they follow." });
    }
  }

  const result = await MessagingService.startConversation(viewerId, targetId);
  return res.json(result);
};

export const getConversationMessages = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const convId = parseInt(req.params.conversationId);
  try {
    const messages = await MessagingService.getConversationMessages(convId, viewerId);
    return res.json(messages);
  } catch (e: any) {
    if (e.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw e;
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const count = await MessagingService.getUnreadMessageCount(viewerId);
  return res.json({ count });
};

export const sendMessage = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { recipientId, conversationId, content } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  try {
    const message = await MessagingService.sendMessage(viewerId, { conversationId, recipientId, content });
    return res.status(201).json(message);
  } catch (error: any) {
    if (error?.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw error;
  }
};

export const markConversationSeen = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req) ?? (req as any).currentUser?.id;
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const convId = Number(req.params.conversationId);

  try {
    const result = await MessagingService.markConversationSeen(convId, viewerId);
    return res.json(result);
  } catch (e: any) {
    if (e.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw e;
  }
};

export const getPaymentProposals = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  try {
    return res.json(await MessagingService.getPaymentProposals(Number(req.params.conversationId), viewerId));
  } catch (error: any) {
    if (error?.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw error;
  }
};

export const createPaymentProposal = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await MessagingService.createPaymentProposal({ conversationId: Number(req.params.conversationId), proposerId: viewerId, ...req.body });
    for (const recipientId of result.recipientIds) {
      const { notify } = await import("../notifications/notification.service");
      void notify({ userId: recipientId, actorId: viewerId, type: "system", title: "Payment terms proposed", message: `${req.body.currency} ${req.body.amount} was proposed for this conversation.`, url: `/messages?conv=${req.params.conversationId}` });
    }
    const { emitToConversation } = await import("../../lib/socket");
    emitToConversation(Number(req.params.conversationId), "payment:proposal", result.proposal);
    return res.status(201).json(result.proposal);
  } catch (error: any) {
    if (error?.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw error;
  }
};

export const updatePaymentProposal = async (req: Request, res: Response) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  try {
    return res.json(await MessagingService.updatePaymentProposal(Number(req.params.proposalId), viewerId, req.body.status));
  } catch (error: any) {
    if (error?.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    if (error?.message === "Not found") return res.status(404).json({ error: error.message });
    throw error;
  }
};
