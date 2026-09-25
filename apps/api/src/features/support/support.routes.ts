import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { reportsTable, safetyPreferencesTable, supportMessagesTable, supportTicketsTable, usersTable } from "@workspace/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../middleware/admin";
import { preventSpam } from "../../middleware/abuseProtection";
import { validateBody, validateParams } from "../../middleware/validate";
import { emitToSupportTicket, emitToUser } from "../../lib/socket";
import { logger } from "../../lib/logger";
import { notify } from "../notifications/notification.service";
import { sendEmail } from "../email/email.service";

export const supportRouter = Router();
supportRouter.use(requireAuth);

supportRouter.get("/tickets", async (req: any, res) => {
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, req.currentUser.id))
    .orderBy(desc(supportTicketsTable.updatedAt));
  return res.json({ tickets });
});

supportRouter.get("/admin/tickets", requirePermission("manage_support"), async (_req: any, res) => {
  const tickets = await db
    .select({
      id: supportTicketsTable.id,
      userId: supportTicketsTable.userId,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      severity: supportTicketsTable.severity,
      status: supportTicketsTable.status,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
    })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
    .orderBy(desc(supportTicketsTable.updatedAt));
  return res.json({ tickets });
});

supportRouter.get("/admin/tickets/:id/messages", requirePermission("manage_support"), validateParams(z.object({ id: z.coerce.number().int().positive() })), async (req: any, res) => {
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, Number(req.params.id)));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const messages = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.ticketId, ticket.id)).orderBy(supportMessagesTable.createdAt);
  return res.json({ ticket, messages });
});

supportRouter.post("/admin/tickets/:id/message", requirePermission("manage_support"), validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(z.object({ message: z.string().min(1).max(5_000) })), async (req: any, res) => {
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, Number(req.params.id)));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const [message] = await db.insert(supportMessagesTable).values({ ticketId: ticket.id, userId: req.currentUser.id, message: req.body.message, fileId: null }).returning();
  await db.update(supportTicketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticket.id));
  await notify({ userId: ticket.userId, actorId: req.currentUser.id, type: "admin_action", title: "Support replied", message: req.body.message.slice(0, 160), url: "/support" });
  emitToSupportTicket(ticket.id, "support:message", { ticketId: ticket.id, message });
  emitToUser(ticket.userId, "support:message", { ticketId: ticket.id, message });
  return res.status(201).json(message);
});

supportRouter.patch("/admin/tickets/:id", requirePermission("manage_support"), validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(z.object({ status: z.enum(["open", "pending", "resolved", "closed"]) })), async (req: any, res) => {
  const [ticket] = await db.update(supportTicketsTable).set({ status: req.body.status, updatedAt: new Date() }).where(eq(supportTicketsTable.id, Number(req.params.id))).returning();
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  emitToSupportTicket(ticket.id, "support:updated", { ticket });
  return res.json(ticket);
});

supportRouter.post("/tickets", preventSpam("support-tickets", { max: 5, windowMs: 60_000, contentField: "subject" }), validateBody(z.object({
  subject: z.string().min(3).max(180),
  message: z.string().min(1).max(5_000),
  category: z.enum(["bug", "abuse", "billing", "account", "upload", "general"]).optional(),
  severity: z.enum(["low", "normal", "high", "urgent"]).optional(),
  fileId: z.number().int().positive().optional(),
})), async (req: any, res) => {
  const [supportOwner] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.role, "super_admin"), eq(usersTable.isDeleted, false))).limit(1);
  if (!supportOwner) return res.status(503).json({ error: "Support is temporarily unavailable. Please try again later." });

  const { ticket, message } = await db.transaction(async (tx) => {
    const [createdTicket] = await tx.insert(supportTicketsTable).values({
      userId: req.currentUser.id,
      subject: req.body.subject,
      category: req.body.category ?? "general",
      severity: req.body.severity ?? "normal",
    }).returning();
    const [createdMessage] = await tx.insert(supportMessagesTable).values({
      ticketId: createdTicket.id,
      userId: req.currentUser.id,
      message: req.body.message,
      fileId: req.body.fileId ?? null,
    }).returning();
    return { ticket: createdTicket, message: createdMessage };
  });
  const { sendEmail } = await import("../email/email.service");
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `New QuillHive support message: ${req.body.subject ?? "No subject"}`,
      html: `
        <p><strong>From:</strong> ${req.currentUser.email ?? "Anonymous"}</p>
        <p><strong>Message:</strong></p>
        <p>${req.body.message}</p>
      `,
    }).catch(() => {});
  }
  if (supportOwner && supportOwner.id !== req.currentUser.id) {
    void notify({
      userId: supportOwner.id,
      actorId: req.currentUser.id,
      type: "system",
      title: "New support ticket",
      message: `${req.currentUser.displayName ?? req.currentUser.username ?? "A member"}: ${req.body.subject}`,
      url: "/support",
    }).catch(() => {});
  }
  emitToUser(req.currentUser.id, "support:message", { ticket, message });
  return res.status(201).json({ ticket, message });
});

supportRouter.get("/tickets/:id/messages", validateParams(z.object({ id: z.coerce.number().int().positive() })), async (req: any, res) => {
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, Number(req.params.id)), eq(supportTicketsTable.userId, req.currentUser.id)));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const messages = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.ticketId, ticket.id)).orderBy(supportMessagesTable.createdAt);
  return res.json({ ticket, messages });
});

supportRouter.post("/tickets/:id/message", validateParams(z.object({ id: z.coerce.number().int().positive() })), preventSpam("support-messages", { max: 20, windowMs: 60_000, contentField: "message" }), validateBody(z.object({
  message: z.string().min(1).max(5_000),
  fileId: z.number().int().positive().optional(),
})), async (req: any, res) => {
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, Number(req.params.id)), eq(supportTicketsTable.userId, req.currentUser.id)));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const [message] = await db.insert(supportMessagesTable).values({
    ticketId: ticket.id,
    userId: req.currentUser.id,
    message: req.body.message,
    fileId: req.body.fileId ?? null,
  }).returning();
  await db.update(supportTicketsTable).set({ updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticket.id));
  const [supportOwner] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "super_admin")).limit(1);
  if (supportOwner && supportOwner.id !== req.currentUser.id) {
    void notify({ userId: supportOwner.id, actorId: req.currentUser.id, type: "system", title: "Support ticket updated", message: `${req.currentUser.displayName ?? req.currentUser.username ?? "A member"} replied to ${ticket.subject}`, url: "/admin" }).catch(() => {});
  }
  emitToSupportTicket(ticket.id, "support:message", { ticketId: ticket.id, message });
  emitToUser(req.currentUser.id, "support:message", { ticketId: ticket.id, message });
  return res.status(201).json(message);
});

supportRouter.post("/report", preventSpam("reports", { max: 8, windowMs: 60_000, contentField: "reason" }), validateBody(z.object({
  targetType: z.enum(["post", "comment", "user", "message", "job", "upload", "other"]),
  targetId: z.number().int().positive(),
  reason: z.string().min(3).max(1_000),
  details: z.string().max(2_000).optional(),
  category: z.enum(["scam_fraud", "spam", "harassment", "csam", "self_harm", "violence", "ip_violation", "impersonation", "misinfo", "other"]).optional(),
  severity: z.enum(["low", "normal", "high", "urgent"]).optional(),
})), async (req: any, res) => {
  const category = req.body.category ?? "other";
  const details = typeof req.body.details === "string" ? req.body.details.trim() : "";
  // Auto-route critical categories to urgent priority
  const autoPriority = category === "csam" || category === "self_harm" || category === "violence"
    ? "urgent"
    : category === "harassment" || category === "impersonation"
      ? "high"
      : (req.body.severity ?? "normal");
  const [report] = await db.insert(reportsTable).values({
    reporterId: req.currentUser.id,
    targetType: req.body.targetType,
    targetId: req.body.targetId,
    reason: `[${req.body.severity ?? "normal"}] ${req.body.reason}${details ? `: ${details}` : ""}`,
    category,
    priority: autoPriority,
    status: "pending",
  }).returning();
  res.status(201).json(report);

  if (category === "scam_fraud") {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "super_admin"]));
    await Promise.all(admins.map((admin) => notify({
      userId: admin.id,
      actorId: 0,
      type: "admin_alert",
      title: "Scam report needs review",
      message: `A user reported ${req.body.targetType} #${req.body.targetId} for scam/fraud.`,
      url: "/admin?tab=content",
    })));
    if (process.env.OWNER_EMAIL) {
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: "🚨 Scam report on QuillHive — needs review",
        html: `<p>A user reported ${req.body.targetType} #${req.body.targetId} for scam/fraud.</p><p>Details: ${details || "No additional details provided."}</p><p><a href="${process.env.APP_URL ?? ""}/admin">Review now →</a></p>`,
        text: `A user reported ${req.body.targetType} #${req.body.targetId} for scam/fraud. Details: ${details || "No additional details provided."}`,
      });
    }
  }

  // Fire-and-forget AI content moderation - does not block the response
  (async () => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return;

      // Fetch the reported content if it's a post
      if (req.body.targetType !== 'post') return;
      const { postsTable } = await import('@workspace/db/schema');
      const { eq } = await import('drizzle-orm');
      const [post] = await db
        .select({ title: postsTable.title, content: postsTable.content })
        .from(postsTable)
        .where(eq(postsTable.id, req.body.targetId))
        .limit(1);
      if (!post) return;

      const excerpt = (post.content ?? '').slice(0, 500);
      const prompt = `You are a content moderation assistant for QuillHive, a creative writing platform.
Review this content and respond with ONLY a JSON object, no extra text:
{ "flagged": boolean, "severity": "low" | "medium" | "high", "reason": string }

Content to review: ${post.title ?? '(untitled)'} - ${excerpt}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) return;

      const data = await response.json() as any;
      const text = data.content?.[0]?.text ?? '';
      const aiFlag = JSON.parse(text) as { flagged: boolean; severity: string; reason: string };

      if (aiFlag.flagged && aiFlag.severity === 'high') {
        const { eq: eqDrizzle } = await import('drizzle-orm');
        await db
          .update(reportsTable)
          .set({ reason: `[AI:HIGH] ${aiFlag.reason} | Original: ${report.reason}` })
          .where(eqDrizzle(reportsTable.id, report.id));
        logger.warn({ reportId: report.id, aiFlag }, 'AI flagged report as high severity');
      }
    } catch (err) {
      // Swallow all errors - AI flagging must never break the report submission
      logger.warn({ err }, 'AI content flagging failed silently');
    }
  })();
  return;
});

supportRouter.get("/safety", async (req: any, res) => {
  const [prefs] = await db.select().from(safetyPreferencesTable).where(eq(safetyPreferencesTable.userId, req.currentUser.id));
  return res.json(prefs ? {
    mutedWords: JSON.parse(prefs.mutedWords),
    blockedUserIds: JSON.parse(prefs.blockedUserIds),
    contentFilter: prefs.contentFilter,
  } : { mutedWords: [], blockedUserIds: [], contentFilter: "standard" });
});

supportRouter.put("/safety", validateBody(z.object({
  mutedWords: z.array(z.string().min(1).max(60)).max(100).optional(),
  blockedUserIds: z.array(z.number().int().positive()).max(500).optional(),
  contentFilter: z.enum(["off", "standard", "strict"]).optional(),
})), async (req: any, res) => {
  const existing = await db.select().from(safetyPreferencesTable).where(eq(safetyPreferencesTable.userId, req.currentUser.id));
  const values = {
    userId: req.currentUser.id,
    mutedWords: JSON.stringify(req.body.mutedWords ?? []),
    blockedUserIds: JSON.stringify(req.body.blockedUserIds ?? []),
    contentFilter: req.body.contentFilter ?? "standard",
    updatedAt: new Date(),
  };
  const [prefs] = existing.length
    ? await db.update(safetyPreferencesTable).set(values).where(eq(safetyPreferencesTable.userId, req.currentUser.id)).returning()
    : await db.insert(safetyPreferencesTable).values(values).returning();
  return res.json({
    mutedWords: JSON.parse(prefs.mutedWords),
    blockedUserIds: JSON.parse(prefs.blockedUserIds),
    contentFilter: prefs.contentFilter,
  });
});