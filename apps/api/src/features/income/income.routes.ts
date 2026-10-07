import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { incomeLogsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, sum, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { requireCreatorIncomeEnabled } from "../../middleware/creatorIncome";

export const incomeRouter = Router();
incomeRouter.use(requireCreatorIncomeEnabled);

const createIncomeSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  source: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  date: z.string().datetime(),
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

incomeRouter.get("/", requireAuth, validateQuery(z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})), async (req: any, res) => {
  const { year, month, limit, offset } = req.query;

  const conditions = [eq(incomeLogsTable.userId, req.currentUser.id)];
  if (year) {
    const start = new Date(year, (month ? month - 1 : 0), 1);
    const end = month ? new Date(year, month, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);
    conditions.push(gte(incomeLogsTable.date, start));
    conditions.push(lte(incomeLogsTable.date, end));
  }

  const [rows, totalRow] = await Promise.all([
    db.select().from(incomeLogsTable).where(and(...conditions)).orderBy(desc(incomeLogsTable.date)).limit(limit).offset(offset),
    db.select({ total: sql<number>`COALESCE(SUM(${incomeLogsTable.amount}), 0)::numeric` }).from(incomeLogsTable).where(and(...conditions)),
  ]);

  return res.json({ logs: rows, total: Number(totalRow[0]?.total ?? 0) });
});

incomeRouter.post("/", requireAuth, validateBody(createIncomeSchema), async (req: any, res) => {
  const [log] = await db.insert(incomeLogsTable).values({
    userId: req.currentUser.id,
    amount: req.body.amount,
    currency: req.body.currency,
    source: req.body.source,
    description: req.body.description,
    date: new Date(req.body.date),
  }).returning();
  return res.status(201).json(log);
});

incomeRouter.delete("/:id", requireAuth, validateParams(idParams), async (req: any, res) => {
  const [log] = await db.select().from(incomeLogsTable).where(and(eq(incomeLogsTable.id, Number(req.params.id)), eq(incomeLogsTable.userId, req.currentUser.id)));
  if (!log) return res.status(404).json({ error: "Not found" });
  await db.delete(incomeLogsTable).where(eq(incomeLogsTable.id, log.id));
  return res.json({ ok: true });
});

incomeRouter.get("/summary", requireAuth, async (req: any, res) => {
  const currentYear = new Date().getFullYear();
  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(${incomeLogsTable.date}, 'YYYY-MM')`,
      total: sql<number>`COALESCE(SUM(${incomeLogsTable.amount}), 0)::numeric`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(incomeLogsTable)
    .where(and(eq(incomeLogsTable.userId, req.currentUser.id), gte(incomeLogsTable.date, new Date(currentYear, 0, 1))))
    .groupBy(sql`to_char(${incomeLogsTable.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${incomeLogsTable.date}, 'YYYY-MM')`);

  const [yearTotal] = await db
    .select({ total: sql<number>`COALESCE(SUM(${incomeLogsTable.amount}), 0)::numeric` })
    .from(incomeLogsTable)
    .where(and(eq(incomeLogsTable.userId, req.currentUser.id), gte(incomeLogsTable.date, new Date(currentYear, 0, 1))));

  return res.json({
    yearTotal: Number(yearTotal?.total ?? 0),
    monthly: monthlyRows.map(r => ({ month: r.month, total: Number(r.total), count: r.count })),
  });
});
