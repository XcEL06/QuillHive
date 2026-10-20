import { z } from "zod";

export const coinCreditSchema = z.object({
  userId: z.number().int().positive().max(2_147_483_647),
  amount: z.number().int().positive().max(2_147_483_647),
  reason: z.string().trim().min(3).max(500),
  basis: z.string().trim().min(3).max(500),
});
