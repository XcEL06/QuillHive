import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Flutterwave webhook signature validation", () => {
  let server: Server | undefined;
  let previousWebhookSecret: string | undefined;
  let previousDatabaseUrl: string | undefined;
  let boostRouter: (typeof import("../features/boost/boost.routes"))["boostRouter"];

  beforeAll(async () => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
    ({ boostRouter } = await import("../features/boost/boost.routes"));
  });

  beforeEach(() => {
    previousWebhookSecret = process.env.FLW_WEBHOOK_SECRET;
    process.env.FLW_WEBHOOK_SECRET = "valid-webhook-secret";
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
    if (previousWebhookSecret === undefined) delete process.env.FLW_WEBHOOK_SECRET;
    else process.env.FLW_WEBHOOK_SECRET = previousWebhookSecret;
  });

  afterAll(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  async function startWebhookServer(): Promise<string> {
    const app = express();
    app.use(express.json());
    app.use(boostRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start webhook test server");
    return `http://127.0.0.1:${address.port}/webhook`;
  }

  it("cleanly rejects a short signature at the webhook endpoint", async () => {
    const endpoint = await startWebhookServer();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "verif-hash": "short" },
      body: JSON.stringify({ event: "signature.test" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid webhook signature" });
  });

  it("accepts a correctly signed payload at the webhook endpoint", async () => {
    const endpoint = await startWebhookServer();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "verif-hash": "valid-webhook-secret" },
      body: JSON.stringify({ event: "signature.test" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
});