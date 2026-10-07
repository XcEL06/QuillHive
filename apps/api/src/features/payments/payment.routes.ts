import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams } from "../../middleware/validate";
import {
  initiatePayment,
  verifyTransaction,
  verifyWebhookSignature,
  isConfigured,
  type Currency,
} from "./flutterwave.service";
import { logger } from "../../lib/logger";
import { db } from "@workspace/db";
import { usersTable, incomeLogsTable, serviceListingsTable, commissionRequestsTable, creatorEarningsTable, creatorPaymentTransactionsTable, notificationsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireCreatorIncomeEnabled } from "../../middleware/creatorIncome";

interface AuthedReq extends Request {
  currentUser: { id: number; email?: string; displayName?: string };
}

export const paymentRouter = Router();

paymentRouter.get("/status", (_req, res) => {
  return res.json({ configured: isConfigured(), gateway: "flutterwave" });
});

const serviceCheckoutSchema = z.object({
  serviceListingId: z.number().int().positive(),
  redirectUrl: z.string().url(),
});
const SUPPORTED_SERVICE_CURRENCIES = ["USD", "NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "RWF", "GBP", "EUR"] as const;

paymentRouter.post("/service/initiate", requireCreatorIncomeEnabled, requireAuth, validateBody(serviceCheckoutSchema), async (req: Request, res: Response) => {
  if (!isConfigured()) return res.status(503).json({ error: "payment_gateway_not_configured" });

  const buyerId = (req as AuthedReq).currentUser.id;
  const { serviceListingId, redirectUrl } = req.body as z.infer<typeof serviceCheckoutSchema>;
  const [listing] = await db.select().from(serviceListingsTable).where(and(
    eq(serviceListingsTable.id, serviceListingId),
    eq(serviceListingsTable.isActive, true),
    eq(serviceListingsTable.pricingModel, "fixed"),
  ));
  if (!listing) return res.status(404).json({ error: "fixed_price_service_not_found" });
  if (listing.creatorId === buyerId) return res.status(400).json({ error: "cannot_buy_own_service" });
  if (!listing.priceFrom || listing.priceFrom <= 0) return res.status(400).json({ error: "service_price_not_set" });
  if (!(SUPPORTED_SERVICE_CURRENCIES as readonly string[]).includes(listing.currency)) return res.status(400).json({ error: "service_currency_not_supported" });

  const [buyer] = await db.select({ email: usersTable.email, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, buyerId));
  if (!buyer) return res.status(404).json({ error: "user_not_found" });

  const txRef = `QH-SVC-${buyerId}-${randomUUID().split("-")[0].toUpperCase()}`;
  const [commission] = await db.insert(commissionRequestsTable).values({
    fromUserId: buyerId,
    toCreatorId: listing.creatorId,
    serviceListingId: listing.id,
    title: listing.title,
    description: `Paid service purchase for "${listing.title}". The creator can begin delivery after confirming the brief.`,
    budget: listing.priceFrom,
    currency: listing.currency,
    status: "payment_pending",
  }).returning({ id: commissionRequestsTable.id });
  await db.insert(creatorPaymentTransactionsTable).values({
    buyerId,
    creatorId: listing.creatorId,
    serviceListingId: listing.id,
    commissionRequestId: commission.id,
    amount: listing.priceFrom,
    currency: listing.currency as Currency,
    txRef,
  });

  try {
    const result = await initiatePayment({
      amount: listing.priceFrom,
      currency: listing.currency as Currency,
      email: buyer.email,
      name: buyer.displayName || buyer.email,
      userId: buyerId,
      txRef,
      redirectUrl,
      description: `Purchase: ${listing.title}`,
      meta: { service_listing_id: listing.id, creator_id: listing.creatorId },
    });
    return res.json({ ok: true, link: result.link, txRef: result.txRef });
  } catch (err) {
    await db.update(commissionRequestsTable)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(commissionRequestsTable.id, commission.id));
    await db.update(creatorPaymentTransactionsTable).set({ status: "failed" }).where(eq(creatorPaymentTransactionsTable.txRef, txRef));
    logger.error({ err, buyerId, serviceListingId }, "service_payment_initiate_failed");
    return res.status(502).json({ error: "payment_initiate_failed" });
  }
});

const initiateSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["USD", "NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "RWF", "GBP", "EUR"] as [Currency, ...Currency[]]),
  redirectUrl: z.string().url(),
  description: z.string().max(500).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

paymentRouter.post(
  "/initiate",
  requireAuth,
  validateBody(initiateSchema),
  async (req: Request, res: Response) => {
    if (!isConfigured()) return res.status(503).json({ error: "payment_gateway_not_configured" });
    const userId = (req as AuthedReq).currentUser.id;
    const { amount, currency, redirectUrl, description, meta } = req.body as z.infer<typeof initiateSchema>;

    const [user] = await db
      .select({ email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const txRef = `QH-${userId}-${randomUUID().split("-")[0].toUpperCase()}`;

    try {
      const result = await initiatePayment({
        amount,
        currency,
        email: user.email,
        name: user.displayName || user.email,
        userId,
        txRef,
        redirectUrl,
        description,
        meta,
      });
      return res.json({ ok: true, link: result.link, txRef: result.txRef });
    } catch (err) {
      logger.error({ err, userId }, "payment_initiate_failed");
      return res.status(502).json({ error: "payment_initiate_failed" });
    }
  },
);

const verifyParams = z.object({ transactionId: z.string().min(1) });

paymentRouter.get(
  "/verify/:transactionId",
  requireAuth,
  validateParams(verifyParams),
  async (req: Request, res: Response) => {
    if (!isConfigured()) return res.status(503).json({ error: "payment_gateway_not_configured" });
    const userId = (req as AuthedReq).currentUser.id;
    try {
      const result = await verifyTransaction(req.params.transactionId as string);
      return res.json(result);
    } catch (err) {
      logger.error({ err, userId }, "payment_verify_failed");
      return res.status(502).json({ error: "payment_verify_failed" });
    }
  },
);

const serviceVerifySchema = z.object({ transactionId: z.string().min(1), txRef: z.string().min(1) });

paymentRouter.get("/service/verify", requireCreatorIncomeEnabled, requireAuth, async (req: Request, res: Response) => {
  if (!isConfigured()) return res.status(503).json({ error: "payment_gateway_not_configured" });
  const parsed = serviceVerifySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "transactionId and txRef are required" });
  const buyerId = (req as AuthedReq).currentUser.id;
  const [payment] = await db.select().from(creatorPaymentTransactionsTable).where(and(
    eq(creatorPaymentTransactionsTable.txRef, parsed.data.txRef),
    eq(creatorPaymentTransactionsTable.buyerId, buyerId),
  ));
  if (!payment) return res.status(404).json({ error: "payment_not_found" });
  if (payment.status === "paid") return res.json({ ok: true, status: "paid", creatorId: payment.creatorId });

  try {
    const result = await verifyTransaction(parsed.data.transactionId);
    if (!result.success || result.txRef !== payment.txRef || result.amount !== payment.amount || result.currency !== payment.currency) {
      return res.status(400).json({ error: "payment_verification_failed" });
    }
    const paidAt = new Date();
    const [markedPaid] = await db.update(creatorPaymentTransactionsTable).set({ status: "paid", transactionId: parsed.data.transactionId, paidAt }).where(and(eq(creatorPaymentTransactionsTable.id, payment.id), eq(creatorPaymentTransactionsTable.status, "pending"))).returning({ id: creatorPaymentTransactionsTable.id });
    if (!markedPaid) return res.json({ ok: true, status: "paid", creatorId: payment.creatorId });
    if (payment.commissionRequestId) {
      await db.update(commissionRequestsTable).set({ status: "accepted", respondedAt: paidAt, updatedAt: paidAt }).where(eq(commissionRequestsTable.id, payment.commissionRequestId));
      await db.insert(notificationsTable).values({ userId: payment.creatorId, actorId: buyerId, type: "commission_request", message: `A paid service purchase is ready: "${payment.txRef}"`, category: "opportunity" }).onConflictDoNothing();
    }
    await db.insert(creatorEarningsTable).values({ creatorId: payment.creatorId, source: "service_purchase", sourceId: payment.serviceListingId, grossAmount: payment.amount, platformFee: 0, netAmount: payment.amount, currency: payment.currency, status: "pending" });
    await db.insert(incomeLogsTable).values({ userId: payment.creatorId, amount: payment.amount, currency: payment.currency, source: "service_purchase", description: `Service purchase ${payment.txRef}`, date: paidAt });
    return res.json({ ok: true, status: "paid", creatorId: payment.creatorId });
  } catch (err) {
    logger.error({ err, buyerId, txRef: payment.txRef }, "service_payment_verify_failed");
    return res.status(502).json({ error: "payment_verify_failed" });
  }
});

paymentRouter.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["verif-hash"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "missing_signature" });
  const payload = JSON.stringify(req.body);
  if (!verifyWebhookSignature(payload, sig)) {
    return res.status(401).json({ error: "invalid_signature" });
  }
  const event = req.body as { event: string; data?: { status: string; amount: number; currency: string; tx_ref: string; customer?: { id?: string } } };
  logger.info({ event: event.event, txRef: event.data?.tx_ref }, "flutterwave_webhook_received");
  return res.json({ received: true });
});
