import { Router } from "express";
import { z } from "zod";
import * as MessagingController from "./messaging.controller";
import { preventSpam } from "../../middleware/abuseProtection";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams } from "../../middleware/validate";

const conversationParamsSchema = z.object({ conversationId: z.coerce.number().int().positive() });
const startConversationSchema = z.object({ userId: z.coerce.number().int().positive() });
const sendMessageSchema = z.object({
  recipientId: z.coerce.number().int().positive().optional(),
  conversationId: z.coerce.number().int().positive().optional(),
  content: z.string().min(1).max(5_000),
}).refine(value => value.recipientId || value.conversationId, { message: "recipientId or conversationId is required" });

export const messagesRouter = Router();
messagesRouter.get("/unread-count", MessagingController.getUnreadCount);
messagesRouter.get("/conversations", MessagingController.getConversations);
messagesRouter.post("/start", preventSpam("conversation-start", { max: 10, windowMs: 60_000, contentField: "userId" }), validateBody(startConversationSchema), MessagingController.startConversation);
messagesRouter.get("/conversations/:conversationId", validateParams(conversationParamsSchema), MessagingController.getConversationMessages);
messagesRouter.post("/conversations/:conversationId/seen", requireAuth, validateParams(conversationParamsSchema), MessagingController.markConversationSeen);
messagesRouter.post("/send", preventSpam("messages", { max: 20, windowMs: 60_000 }), validateBody(sendMessageSchema), MessagingController.sendMessage);
messagesRouter.get("/conversations/:conversationId/payment-proposals", validateParams(conversationParamsSchema), MessagingController.getPaymentProposals);
messagesRouter.post("/conversations/:conversationId/payment-proposals", validateParams(conversationParamsSchema), validateBody(z.object({ amount: z.coerce.number().positive(), currency: z.string().length(3), note: z.string().max(1000).optional() })), MessagingController.createPaymentProposal);
messagesRouter.patch("/conversations/:conversationId/payment-proposals/:proposalId", validateParams(z.object({ conversationId: z.coerce.number().int().positive(), proposalId: z.coerce.number().int().positive() })), validateBody(z.object({ status: z.enum(["accepted", "rejected"]) })), MessagingController.updatePaymentProposal);
