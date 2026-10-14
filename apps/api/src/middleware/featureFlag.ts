import type { RequestHandler } from "express";
import { isFeatureEnabled, type FeatureFlagKey } from "../lib/featureFlags";

export function requireFeatureFlag(key: FeatureFlagKey): RequestHandler {
  return async (_req, res, next) => {
    try {
      if (!(await isFeatureEnabled(key))) {
        return res.status(403).json({ error: "feature_disabled", feature: key });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}