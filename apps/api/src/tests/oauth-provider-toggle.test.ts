import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabled = vi.hoisted(() => vi.fn());
vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../lib/featureFlags", () => ({ isFeatureEnabled }));

import { oauthRouter } from "../features/auth/oauth.routes";

describe("OAuth provider feature gates", () => {
  let server: ReturnType<typeof createServer> | undefined;
  let origin = "";

  beforeEach(async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const app = express();
    app.use("/api/auth/oauth", oauthRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
  });

  it.each([
    ["google", "google_oauth_enabled"],
    ["github", "github_oauth_enabled"],
  ])("blocks %s redirects when its super-admin flag is off", async (provider, flag) => {
    const response = await fetch(`${origin}/api/auth/oauth/${provider}/start`, { redirect: "manual" });
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(302);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("provider_disabled");
    expect(location.searchParams.get("provider")).toBe(provider);
    expect(isFeatureEnabled).toHaveBeenCalledWith(flag);
  });
});
