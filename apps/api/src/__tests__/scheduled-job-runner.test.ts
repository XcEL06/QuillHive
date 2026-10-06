import { describe, expect, it, vi } from "vitest";
import { runScheduledJob } from "../features/scheduling/scheduledJobRunner";

describe("runScheduledJob", () => {
  it("retries twice with exponential backoff and completes on the third attempt", async () => {
    let attempts = 0;
    const delays: number[] = [];

    const result = await runScheduledJob("test-fail-twice", async () => {
      attempts += 1;
      if (attempts < 3) throw new Error(`transient failure ${attempts}`);
      return "completed";
    }, {
      initialDelayMs: 10,
      wait: async delayMs => { delays.push(delayMs); },
    });

    expect(result).toBe("completed");
    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("stops after the configured attempts and reports the terminal failure", async () => {
    const logger = await import("../lib/logger");
    const logSpy = vi.spyOn(logger.logger, "error").mockImplementation(() => logger.logger as never);
    const failure = new Error("persistent failure");

    await expect(runScheduledJob("test-persistent-failure", async () => {
      throw failure;
    }, {
      attempts: 2,
      initialDelayMs: 0,
      wait: async () => {},
    })).rejects.toBe(failure);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, name: "test-persistent-failure", attempts: 2 }),
      "Scheduled job failed after retries",
    );
    logSpy.mockRestore();
  });
});