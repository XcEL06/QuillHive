import type { RequestHandler } from "express";
import { isFeatureEnabled } from "../lib/featureFlags";

export const requireCreatorIncomeEnabled: RequestHandler = async (_req, res, next) => {
  try {
    if (!(await isFeatureEnabled("creator_income_enabled"))) {
      return res.status(403).json({
        error: "creator_income_disabled",
        message: "Creator income features are currently disabled.",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
