import express, { type Express, type NextFunction, type Request, type Response } from "express";
import compression from "compression";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { sitemapRouter } from "./features/distribution/sitemap.routes";
import { rssRouter } from "./features/distribution/rss.routes";
import { activityPubRouter } from "./features/distribution/activitypub.routes";
import { db } from "@workspace/db";
import { postsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { emitEvent, recordRequest } from "./lib/events";
import { recordError, recordRequestForAnomaly } from "./lib/alertEngine";
import { getApiErrorMessage } from "./lib/api-errors";
import { validateBearerTokenState } from "./middleware/admin";

const app: Express = express();
app.disable('x-powered-by');

// Trust proxy for rate limiting to work correctly behind reverse proxy/load balancer
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // Trust 1 proxy (e.g., load balancer)
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(securityHeaders);
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    const appUrl = process.env.APP_URL ?? "";
    const allowed =
      (appUrl && origin === appUrl) ||
      /^https:\/\/(?:[^/]+\.)?quillhive\.pages\.dev$/.test(origin ?? "") ||
      (process.env.NODE_ENV !== "production" && (
        /^https?:\/\/[^/]*\.replit\.dev$/.test(origin ?? "") ||
        /^https?:\/\/[^/]*\.repl\.co$/.test(origin ?? "") ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin ?? "")
      ));
    if (allowed) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.use(
  // Profile/post media is uploaded as base64 JSON by the existing clients.
  // Keep the request bounded, but large enough for the documented 50 MB file
  // limit after base64 expansion.
  express.json({
    limit: "70mb",
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.url?.includes("/boost/webhook") || req.url?.includes("/boost/stripe/webhook")) {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Serve local file uploads (fallback when Cloudinary is not configured)
const localUploadsDir = path.resolve(process.cwd(), "../../features/quillhive/uploads");
if (!existsSync(localUploadsDir)) mkdirSync(localUploadsDir, { recursive: true });
app.use("/uploads", express.static(localUploadsDir, { maxAge: "7d", immutable: false }));

// Request + anomaly counters (must run before routes)
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    recordRequest();
    recordRequestForAnomaly();
  }
  next();
});

// Public feature flags - read-only, no auth required
app.get("/api/features", async (_req, res) => {
  try {
    const { getAllFeatureFlags } = await import("./lib/featureFlags");
    const all = await getAllFeatureFlags();

    const PUBLIC_FLAGS = [
      "polls_enabled",
      "motion_enabled",
      "chains_enabled",
      "series_enabled",
      "highlights_enabled",
      "gallery_enabled",
      "embed_enabled",
      "ab_testing_enabled",
      "collections_enabled",
      "magic_link_enabled",
      "passkey_enabled",
      "income_tracker_enabled",
      "ai_tools_enabled",
      "quick_posts_enabled",
      "registration_open",
      "maintenance_mode",
    ] as const;

    const result: Record<string, boolean> = {};
    for (const k of PUBLIC_FLAGS) {
      result[k] = (all as Record<string, boolean>)[k] ?? true;
    }

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    return res.json(result);
  } catch {
    // Keep the public contract stable even when the settings table is
    // temporarily unavailable. In particular, do not default maintenance
    // mode to true and render a broken SPA.
    return res.json({ maintenance_mode: false });
  }
});

app.use("/api", validateBearerTokenState);
app.use("/api", router);

// Capture API errors → owner intelligence (after routes, before SPA)
app.use((err: Error & { statusCode?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.path.startsWith("/api")) return next(err);
  recordError();
  const status = err.statusCode || 500;
  if (status >= 500) {
    emitEvent({
      type: "SYSTEM_ERROR",
      severity: status >= 500 ? "high" : "medium",
      message: err.message?.slice(0, 200) || "Unhandled API error",
      metadata: {
        route: req.path,
        method: req.method,
        statusCode: status,
        errorName: err.name,
      },
    });
  }
  if (res.headersSent) return next(err);
  res.status(status).json({ error: getApiErrorMessage(status, err.message) });
});

// Public distribution endpoints served at the root for clean URLs
app.use(sitemapRouter);
app.use(rssRouter);
app.use(activityPubRouter);

const webDist = path.resolve(process.cwd(), "../web/dist");

// ── Dynamic OG meta injection for social sharing ──────────────────────────
// Only fires for real browser navigations (Accept: text/html), not API calls.
// Reads the built index.html and replaces placeholder meta tags with real data.
const getIndexHtml = (() => {
  let cached: string | null = null;
  return () => {
    if (!cached) {
      const indexPath = path.join(webDist, "index.html");
      if (existsSync(indexPath)) cached = readFileSync(indexPath, "utf-8");
    }
    return cached;
  };
})();

function injectOgMeta(html: string, meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const fallbackImage = `${process.env.APP_URL || ""}/opengraph.jpg`;
  const img = meta.image || fallbackImage;
  const inject = `
    <meta property="og:title" content="${meta.title.replace(/"/g, "&quot;")}" />
    <meta property="og:description" content="${meta.description.replace(/"/g, "&quot;")}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${meta.url}" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title.replace(/"/g, "&quot;")}" />
    <meta name="twitter:description" content="${meta.description.replace(/"/g, "&quot;")}" />
    <meta name="twitter:image" content="${img}" />`;
  return html.replace("</head>", inject + "\n  </head>");
}

app.get("/post/:id", async (req, res, next) => {
  if (!req.accepts("html")) return next();
  const html = getIndexHtml();
  if (!html) return next();
  try {
    const [post] = await db
      .select({
        title: postsTable.title,
        content: postsTable.content,
        excerpt: postsTable.excerpt,
        imageUrl: postsTable.imageUrl,
        authorName: usersTable.displayName,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(and(
        eq(postsTable.id, Number(req.params.id)),
        eq(postsTable.isPublished, true),
        eq(postsTable.isDeleted, false),
      ));
    if (!post) return next();
    const origin = process.env.APP_URL || `https://${req.hostname}`;
    res.send(injectOgMeta(html, {
      title: post.title || "A post on QuillHive",
      description: (post.excerpt || (post.content ?? "").replace(/<[^>]+>/g, "").slice(0, 160)).trim(),
      image: post.imageUrl || "",
      url: `${origin}/post/${req.params.id}`,
    }));
  } catch {
    next();
  }
});

app.get("/profile/:username", async (req, res, next) => {
  if (!req.accepts("html")) return next();
  const html = getIndexHtml();
  if (!html) return next();
  try {
    const [user] = await db
      .select({
        displayName: usersTable.displayName,
        bio: usersTable.bio,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.username, req.params.username));
    if (!user) return next();
    const origin = process.env.APP_URL || `https://${req.hostname}`;
    res.send(injectOgMeta(html, {
      title: `${user.displayName || req.params.username} on QuillHive`,
      description: (user.bio || `Discover ${user.displayName || req.params.username}'s work on QuillHive - where everyone grows, gets discovered, and finds real opportunities.`).slice(0, 160),
      image: user.avatarUrl || "",
      url: `${origin}/profile/${req.params.username}`,
    }));
  } catch {
    next();
  }
});

// ── Library entry SEO ─────────────────────────────────────────────────────────
app.get("/library/:slug", async (req, res, next) => {
  if (!req.accepts("html")) return next();
  const html = getIndexHtml();
  if (!html) return next();
  try {
    const { libraryEntriesTable: libTable } = await import("@workspace/db/schema");
    const { eq: _eq, and: _and } = await import("drizzle-orm");
    const [entry] = await db
      .select({
        title: libTable.title,
        summary: libTable.summary,
        thumbnailUrl: libTable.thumbnailUrl,
        schemaType: libTable.schemaType,
        contentType: libTable.contentType,
        tags: libTable.tags,
        publishedAt: libTable.publishedAt,
        updatedAt: libTable.updatedAt,
        slug: libTable.slug,
        authorName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      })
      .from(libTable)
      .innerJoin(usersTable, _eq(usersTable.id, libTable.authorId))
      .where(
        _and(
          _eq(libTable.slug, req.params.slug),
          _eq(libTable.isPublic, true),
          _eq(libTable.isApproved, true),
        ),
      )
      .limit(1);
    if (!entry) return next();
    const origin = process.env.APP_URL || `https://${req.hostname}`;
    const pageUrl = `${origin}/library/${entry.slug}`;
    const imageUrl = entry.thumbnailUrl || `${origin}/opengraph.jpg`;
    const tags = Array.isArray(entry.tags) ? (entry.tags as string[]).join(", ") : "";
    const schemaOrg = JSON.stringify({
      "@context": "https://schema.org",
      "@type": entry.schemaType ?? "Article",
      headline: entry.title,
      description: entry.summary,
      image: imageUrl,
      url: pageUrl,
      datePublished: entry.publishedAt,
      dateModified: entry.updatedAt,
      keywords: tags,
      author: {
        "@type": "Person",
        name: entry.authorName,
        url: `${origin}/u/${entry.authorUsername}`,
        image: entry.authorAvatarUrl ?? undefined,
      },
      publisher: {
        "@type": "Organization",
        name: "QuillHive Library",
        url: `${origin}/library`,
        logo: { "@type": "ImageObject", url: `${origin}/images/logo-icon.png` },
      },
    });
    const inject = `
    <title>${entry.title.replace(/</g, "&lt;")} - QuillHive Library</title>
    <meta name="description" content="${entry.summary.replace(/"/g, "&quot;")}" />
    <meta name="keywords" content="${tags.replace(/"/g, "&quot;")}" />
    <meta name="author" content="${entry.authorName?.replace(/"/g, "&quot;") ?? ""}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:title" content="${entry.title.replace(/"/g, "&quot;")}" />
    <meta property="og:description" content="${entry.summary.replace(/"/g, "&quot;")}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="QuillHive Library" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${entry.title.replace(/"/g, "&quot;")}" />
    <meta name="twitter:description" content="${entry.summary.replace(/"/g, "&quot;")}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <script type="application/ld+json">${schemaOrg}</script>`;
    return res.send(html.replace("</head>", inject + "\n  </head>"));
  } catch {
    return next();
  }
});

// ── Public profile SEO (/u/:username) ────────────────────────────────────────
app.get("/u/:username", async (req, res, next) => {
  if (!req.accepts("html")) return next();
  const html = getIndexHtml();
  if (!html) return next();
  try {
    const [user] = await db
      .select({
        displayName: usersTable.displayName,
        username: usersTable.username,
        bio: usersTable.bio,
        headline: usersTable.headline,
        avatarUrl: usersTable.avatarUrl,
        location: usersTable.location,
        website: usersTable.website,
      })
      .from(usersTable)
      .where(eq(usersTable.username, req.params.username))
      .limit(1);
    if (!user) return next();
    const origin = process.env.APP_URL || `https://${req.hostname}`;
    const profileUrl = `${origin}/u/${user.username}`;
    const description = (
      user.bio ? user.bio.slice(0, 160) :
      user.headline ? user.headline :
      `${user.displayName}'s creative profile on QuillHive.`
    );
    const image = user.avatarUrl || `${origin}/opengraph.jpg`;
    const personSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: user.displayName,
      url: profileUrl,
      image,
      description,
      ...(user.website ? { sameAs: [user.website] } : {}),
      ...(user.location ? { homeLocation: { "@type": "Place", name: user.location } } : {}),
      worksFor: { "@type": "Organization", name: "QuillHive", url: origin },
    });
    const inject = `
    <title>${(user.displayName ?? "").replace(/</g, "&lt;")} (@${user.username}) - QuillHive</title>
    <meta name="description" content="${description.replace(/"/g, "&quot;")}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${profileUrl}" />
    <meta property="og:title" content="${(user.displayName ?? "").replace(/"/g, "&quot;")} on QuillHive" />
    <meta property="og:description" content="${description.replace(/"/g, "&quot;")}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${profileUrl}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="QuillHive" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${(user.displayName ?? "").replace(/"/g, "&quot;")} (@${user.username})" />
    <meta name="twitter:description" content="${description.replace(/"/g, "&quot;")}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${personSchema}</script>`;
    return res.send(html.replace("</head>", inject + "\n  </head>"));
  } catch {
    return next();
  }
});
// ── End OG meta injection ──────────────────────────────────────────────────

if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled request error");
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500
      ? "Something went wrong on our end. Please try again."
      : (err.message || "Request failed"),
  });
});

export default app;
