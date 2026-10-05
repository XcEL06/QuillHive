import { createServer, type Server } from "node:http";
import * as Sentry from "@sentry/node";
import { afterEach, expect, it } from "vitest";
import { initSentry } from "../lib/sentry";
import { logger } from "../lib/logger";

let server: Server | undefined;

afterEach(async () => {
  if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

it("captures a background-job error and sends its event to the configured Sentry endpoint", async () => {
  expect(process.env.NODE_ENV).not.toBe("production");
  const envelopes: string[] = [];
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      envelopes.push(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start local Sentry receiver");

  const previousDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = `http://abcdef0123456789@127.0.0.1:${address.port}/1`;
  try {
    await initSentry();
    logger.error({
      err: new Error("Malformed array literal during job execution"),
      jobId: "observability-test-job",
      name: "scheduled_post",
    }, "Job failed");

    const flushed = await Sentry.flush(3_000);
    expect(flushed).toBe(true);
    expect(envelopes.some((envelope) => envelope.includes("Malformed array literal during job execution"))).toBe(true);
    expect(envelopes.some((envelope) => envelope.includes("observability-test-job"))).toBe(true);
  } finally {
    if (previousDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = previousDsn;
  }
});