import { Router, type Request, type Response } from "express";
import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { oauthAccountsTable, usersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { createAuthTokens } from "../../lib/auth";
import { logger } from "../../lib/logger";
import { isFeatureEnabled } from "../../lib/featureFlags";

export const oauthRouter = Router();

type Provider = "google" | "github";

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scope: string;
  isGithub?: boolean;
}

function configFor(p: Provider): ProviderConfig {
  if (p === "github") {
    return {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scope: "read:user user:email",
      isGithub: true,
    };
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  };
}

function callbackUrl(req: Request, provider: Provider): string {
  const baseUrl = (process.env.API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  return `${baseUrl}/api/auth/oauth/${provider}/callback`;
}

function frontendUrl(): string {
  return (process.env.APP_URL
    ?? process.env.FRONTEND_URL
    ?? process.env.PUBLIC_APP_URL
    ?? "http://localhost:5173").replace(/\/+$/, "");
}

const KNOWN_PROVIDERS: Provider[] = ["google", "github"];

function providerFlag(provider: Provider): string {
  return provider === "google" ? "google_oauth_enabled" : "github_oauth_enabled";
}

function redirectProviderDisabled(res: Response, provider: Provider) {
  const target = new URL("/login", frontendUrl());
  target.searchParams.set("error", "provider_disabled");
  target.searchParams.set("provider", provider);
  return res.redirect(target.toString());
}

oauthRouter.get("/:provider/start", async (req, res: Response) => {
  const provider = req.params.provider as Provider;
  if (!KNOWN_PROVIDERS.includes(provider)) return res.status(404).send("Unknown provider");
  if (!(await isFeatureEnabled(providerFlag(provider)))) return redirectProviderDisabled(res, provider);
  const cfg = configFor(provider);
  if (!cfg.clientId || !cfg.clientSecret) {
    const target = new URL("/login", frontendUrl());
    target.searchParams.set("error", "provider_not_configured");
    target.searchParams.set("provider", provider);
    return res.redirect(target.toString());
  }
  const state = randomBytes(16).toString("base64url");
  res.cookie(`oauth_state_${provider}`, state, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60_000,
  });
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(req, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (provider === "github") {
    params.set("allow_signup", "true");
  }
  return res.redirect(`${cfg.authUrl}?${params.toString()}`);
});

async function handleGithubCallback(req: Request, res: Response): Promise<void> {
  const cfg = configFor("github");
  if (!cfg.clientId || !cfg.clientSecret) {
    const target = new URL("/login", frontendUrl());
    target.searchParams.set("error", "provider_not_configured");
    target.searchParams.set("provider", "github");
    res.redirect(target.toString());
    return;
  }

  if (req.query.error) {
    res.clearCookie("oauth_state_github");
    const target = new URL("/login", frontendUrl());
    target.searchParams.set("error", "oauth_cancelled");
    res.redirect(target.toString());
    return;
  }

  const code = String((req.query.code ?? req.body?.code) || "");
  const state = String((req.query.state ?? req.body?.state) || "");
  const cookieState = req.cookies?.["oauth_state_github"];
  if (!code || !state || state !== cookieState) {
    res.status(400).send("Invalid state"); return;
  }
  res.clearCookie("oauth_state_github");

  const appUrl = frontendUrl();

  try {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "QuillHive/1.0",
      },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret ?? "",
        code,
        redirect_uri: callbackUrl(req, "github"),
      }).toString(),
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      const target = new URL("/login", appUrl);
      target.searchParams.set("error", "oauth_failed");
      return res.redirect(target.toString());
    }

    const ghProfile = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${tokenData.access_token}`,
        "User-Agent": "QuillHive/1.0",
        Accept: "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(10_000),
    }).then(r => r.json()) as {
      id: number; login: string; name?: string;
      avatar_url?: string; email?: string; bio?: string;
    };

    let email = ghProfile.email ?? null;
    if (!email) {
      const emailList = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `token ${tokenData.access_token}`,
          "User-Agent": "QuillHive/1.0",
          Accept: "application/vnd.github.v3+json",
        },
        signal: AbortSignal.timeout(10_000),
      }).then(r => r.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = emailList.find(e => e.primary && e.verified)?.email
        ?? emailList.find(e => e.verified)?.email
        ?? null;
    }

    if (!email) {
      const target = new URL("/login", appUrl);
      target.searchParams.set("error", "no_email");
      return res.redirect(target.toString());
    }

    const providerAccountId = String(ghProfile.id);
    const displayName = ghProfile.name || ghProfile.login;
    const avatarUrl = ghProfile.avatar_url ?? null;

    let [link] = await db.select().from(oauthAccountsTable)
      .where(and(eq(oauthAccountsTable.provider, "github"), eq(oauthAccountsTable.providerAccountId, providerAccountId)));

    let userId: number;
    if (link) {
      userId = link.userId;
    } else {
      let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
      if (!user) {
        let baseUsername = ghProfile.login.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 28);
        let username = baseUsername;
        let suffix = 1;
        while (true) {
          const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
          if (!existing) break;
          username = `${baseUsername}${suffix}`;
          suffix++;
        }
        [user] = await db.insert(usersTable).values({
          username,
          email: email.toLowerCase(),
          passwordHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
          displayName,
          avatarUrl,
          emailVerified: true,
        }).returning();
      }
      userId = user.id;
      await db.insert(oauthAccountsTable).values({
        userId,
        provider: "github",
        providerAccountId,
        email: email.toLowerCase(),
        isPrimary: true,
      });
    }

    const tokens = await createAuthTokens(userId, { userAgent: (req.headers["user-agent"] || "").slice(0, 200) });
    const target = new URL("/auth/oauth-complete", appUrl);
    target.searchParams.set("token", tokens.token);
    target.searchParams.set("refreshToken", tokens.refreshToken);
    return res.redirect(target.toString());
  } catch (error) {
    logger.error({ err: error, provider: "github" }, "GitHub OAuth error");
    const appUrl = frontendUrl();
    const target = new URL("/login", appUrl);
    target.searchParams.set("error", "oauth_error");
    return res.redirect(target.toString());
  }
}

async function handleCallback(req: Request, res: Response, provider: string) {
  if (!KNOWN_PROVIDERS.includes(provider as Provider)) return res.status(404).send("Unknown provider");
  if (!(await isFeatureEnabled(providerFlag(provider as Provider)))) return redirectProviderDisabled(res, provider as Provider);
  if (provider === "github") return handleGithubCallback(req, res);

  const cfg = configFor(provider as Provider);
  if (!cfg.clientId) return res.status(503).send("Provider not configured");
  const code = String((req.query.code ?? req.body?.code) || "");
  const state = String((req.query.state ?? req.body?.state) || "");
  const cookieState = req.cookies?.[`oauth_state_${provider}`];
  if (!code || !state || state !== cookieState) return res.status(400).send("Invalid state");
  res.clearCookie(`oauth_state_${provider}`);

  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret ?? "",
    redirect_uri: callbackUrl(req, provider as Provider),
    grant_type: "authorization_code",
  });
  const r = await fetch(cfg.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) return res.status(400).send("OAuth exchange failed");
  const tok = (await r.json()) as { access_token?: string };
  if (!tok.access_token) return res.status(400).send("OAuth exchange failed");

  let profile: { email: string; sub: string } | null = null;
  if (cfg.userInfoUrl) {
    const u = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!u.ok) return res.status(400).send("OAuth exchange failed");
    const info = (await u.json()) as { email?: string; sub?: string };
    if (!info.email || !info.sub) return res.status(400).send("OAuth exchange failed");
    profile = { email: info.email.toLowerCase(), sub: info.sub };
  }
  if (!profile) return res.status(400).send("OAuth exchange failed");

  let [link] = await db.select().from(oauthAccountsTable)
    .where(and(eq(oauthAccountsTable.provider, provider), eq(oauthAccountsTable.providerAccountId, profile.sub)));

  let userId: number;
  if (link) {
    userId = link.userId;
  } else {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, profile.email));
    if (!user) {
      const username = `user_${randomBytes(4).toString("hex")}`;
      [user] = await db.insert(usersTable).values({
        username,
        email: profile.email,
        passwordHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        displayName: profile.email.split("@")[0],
        emailVerified: true,
      }).returning();
    }
    userId = user.id;
    await db.insert(oauthAccountsTable).values({
      userId, provider, providerAccountId: profile.sub, email: profile.email, isPrimary: true,
    });
  }

  const tokens = await createAuthTokens(userId, { userAgent: (req.headers["user-agent"] || "").slice(0, 200) });
  const base = frontendUrl();
  const target = new URL("/auth/oauth-complete", base);
  target.searchParams.set("token", tokens.token);
  target.searchParams.set("refreshToken", tokens.refreshToken);
  return res.redirect(target.toString());
}

oauthRouter.get("/:provider/callback", (req, res) => handleCallback(req, res, req.params.provider));
oauthRouter.post("/:provider/callback", (req, res) => handleCallback(req, res, req.params.provider));
