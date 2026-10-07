import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { isFeatureEnabled } = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({ isFeatureEnabled }));

import { requireCreatorIncomeEnabled } from "../middleware/creatorIncome";

describe("requireCreatorIncomeEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a clear 403 response when creator income is disabled", async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireCreatorIncomeEnabled({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "creator_income_disabled",
      message: "Creator income features are currently disabled.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when creator income is enabled", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireCreatorIncomeEnabled({} as Request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("passes feature-flag lookup errors to the error handler", async () => {
    const error = new Error("feature flag lookup failed");
    isFeatureEnabled.mockRejectedValue(error);
    const next = vi.fn() as unknown as NextFunction;

    await requireCreatorIncomeEnabled({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
