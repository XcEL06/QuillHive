import { Router } from "express";
import { getSessionUserId } from "../lib/auth";
import { db } from "@workspace/db";
import { translationCacheTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash } from "crypto";
import { getRedis } from "../lib/redis";
import { logger } from "../lib/logger";

const router = Router();
const AI_DAILY_LIMIT = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "50", 10);
const memoryDailyCounts = new Map<string, { count: number; resetAt: number }>();

async function aiDailyRateLimit(req: any, res: any, next: any) {
  const viewerId = getViewerId(req);
  const identity = viewerId ? `user:${viewerId}` : `ip:${req.ip ?? "unknown"}`;
  const now = Date.now();
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  const secondsUntilReset = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `ai:daily:${day}:${identity}`;
  const limit = Number.isFinite(AI_DAILY_LIMIT) && AI_DAILY_LIMIT > 0 ? AI_DAILY_LIMIT : 50;
  let count: number;

  try {
    const redis = getRedis();
    if (redis) {
      count = await redis.incr(key);
      if (count === 1) await redis.set(key, String(count), { ex: secondsUntilReset });
    } else {
      throw new Error("Redis unavailable");
    }
  } catch {
    const bucket = memoryDailyCounts.get(identity);
    if (!bucket || now >= bucket.resetAt) {
      memoryDailyCounts.set(identity, { count: 1, resetAt: resetAt.getTime() });
      count = 1;
    } else {
      bucket.count += 1;
      count = bucket.count;
    }
  }

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
  if (count > limit) {
    res.setHeader("Retry-After", String(secondsUntilReset));
    return res.status(429).json({ error: "Daily AI limit reached. Please try again tomorrow.", retryAfter: secondsUntilReset });
  }
  return next();
}

router.use(aiDailyRateLimit);

function getViewerId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export function getAnthropicConfig(): { apiKey: string; baseUrl: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { apiKey: process.env.ANTHROPIC_API_KEY, baseUrl: "https://api.anthropic.com" };
  }
  if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    return {
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseUrl: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL.replace(/\/$/, ""),
    };
  }
  return null;
}

export function logAiConfiguration(): void {
  if (process.env.ANTHROPIC_API_KEY) {
    logger.info("AI features enabled via ANTHROPIC_API_KEY");
    return;
  }
  if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    logger.info("AI features enabled via AI_INTEGRATIONS_ANTHROPIC_API_KEY");
    return;
  }
  logger.warn("AI features disabled: ANTHROPIC_API_KEY missing");
}

async function callAnthropic(system: string, user: string, maxTokens = 1024): Promise<string> {
  const config = getAnthropicConfig();
  if (!config) throw new Error("AI service not configured");

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${err}`);
  }
  const data = await response.json() as any;
  return data.content?.[0]?.text ?? "";
}

router.post("/caption", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { topic, tone, platform } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required" });
  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service not configured" });
  try {
    const suggestion = await callAnthropic(
      "You are a creative social media caption writer for a creative platform. Write engaging, authentic captions for creators.",
      `Generate 3 creative captions for a post about: "${topic}".\nTone: ${tone || "engaging and authentic"}\nPlatform style: ${platform || "creative writing community"}\n\nFormat as:\n1. [caption with hashtags]\n2. [caption with hashtags]\n3. [caption with hashtags]`,
      512
    );
    return res.json({ suggestion });
  } catch (err) {
    req.log.error({ err }, "AI caption failed");
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

router.post("/improve", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { content, focus } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service not configured" });
  const focusMap: Record<string, string> = {
    clarity: "Improve clarity and readability. Remove jargon, simplify sentences.",
    engagement: "Make it more engaging and compelling with vivid descriptions.",
    flow: "Improve flow and transitions between ideas.",
    impact: "Strengthen the opening hook and closing statement.",
  };
  try {
    const suggestion = await callAnthropic(
      `You are an expert editor for creative writing. ${focusMap[focus] || "Improve overall quality while preserving the author's voice."} Return only the improved version.`,
      `Please improve this text:\n\n${content}`,
      1024
    );
    return res.json({ suggestion });
  } catch (err) {
    req.log.error({ err }, "AI improve failed");
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

router.post("/ideas", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const { theme, genre, mood } = req.body;
  if (!theme) return res.status(400).json({ error: "Theme is required" });
  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service not configured" });
  try {
    const suggestion = await callAnthropic(
      "You are a creative director and writing coach helping creators find unique, compelling ideas.",
      `Generate 5 unique creative writing ideas for:\nTheme: ${theme}\nGenre: ${genre || "any"}\nMood: ${mood || "open"}\n\nFor each idea provide a title, 1-2 sentence premise, and a unique angle. Format as a numbered list.`,
      1024
    );
    return res.json({ suggestion });
  } catch (err) {
    req.log.error({ err }, "AI ideas failed");
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

router.post("/assist", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, context, mode } = req.body;
  if (!prompt || !mode) return res.status(400).json({ error: "Prompt and mode are required" });

  const config = getAnthropicConfig();
  if (!config) {
    return res.status(503).json({ error: "AI service not configured." });
  }

  const modeInstructions: Record<string, string> = {
    continue: "Continue the writing naturally from where it left off. Match the style and tone.",
    improve: "Improve the writing quality. Make it more vivid, engaging, and polished while keeping the core meaning.",
    brainstorm: "Generate 3 creative ideas or directions the writing could take next. Format as a numbered list.",
    summarize: "Summarize the key points of this text in 2-3 sentences.",
  };

  const systemPrompt = `You are a creative writing assistant. ${modeInstructions[mode] || "Help with the writing."}`;
  const userPrompt = context
    ? `Here is the current text:\n\n${context}\n\nUser request: ${prompt}`
    : prompt;

  try {
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      req.log.error({ error }, "Anthropic API error");
      return res.status(500).json({ error: "AI service error" });
    }

    const data = await response.json() as any;
    const suggestion = data.content?.[0]?.text ?? "";
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    return res.json({ suggestion, tokens });
  } catch (err) {
    req.log.error({ err }, "AI assist failed");
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

router.post("/translate", async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ error: "text and targetLang are required" });
  if (text.length > 8000) return res.status(400).json({ error: "Text too long (max 8000 chars)" });

  const supportedLangs = ["en", "es", "ar", "fr", "de", "pt", "hi", "zh", "ja", "ko"];
  if (!supportedLangs.includes(targetLang)) {
    return res.status(400).json({ error: "Unsupported target language" });
  }

  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service not configured" });

  const hash = createHash("sha256").update(text + ":" + targetLang).digest("hex").slice(0, 32);

  try {
    const [cached] = await db
      .select()
      .from(translationCacheTable)
      .where(and(eq(translationCacheTable.originalHash, hash), eq(translationCacheTable.targetLang, targetLang)))
      .limit(1);

    if (cached) {
      await db
        .update(translationCacheTable)
        .set({ hitCount: cached.hitCount + 1, updatedAt: new Date() })
        .where(eq(translationCacheTable.id, cached.id));
      return res.json({ translatedText: cached.translatedText, cached: true, targetLang });
    }
  } catch {
    /* proceed without cache */
  }

  const langNames: Record<string, string> = {
    en: "English", es: "Spanish", ar: "Arabic", fr: "French",
    de: "German", pt: "Portuguese", hi: "Hindi", zh: "Chinese (Simplified)",
    ja: "Japanese", ko: "Korean",
  };

  try {
    const translated = await callAnthropic(
      `You are a professional translator. Translate the given text to ${langNames[targetLang] || targetLang}. Return ONLY the translated text, no explanations or metadata.`,
      text,
      Math.min(text.length * 3, 4096)
    );

    try {
      await db.insert(translationCacheTable).values({
        originalHash: hash,
        sourceLang: "auto",
        targetLang,
        translatedText: translated,
      });
    } catch {
      /* ignore cache write failure */
    }

    return res.json({ translatedText: translated, cached: false, targetLang });
  } catch (err) {
    req.log.error({ err }, "AI translate failed");
    return res.status(500).json({ error: "Translation service unavailable" });
  }
});

router.post("/titles", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service unavailable" });
  const { content, type } = req.body;
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content required" });
  const snippet = content.slice(0, 1500);
  try {
    const raw = await callAnthropic(
      "You are a headline expert for a creator platform. Generate 3 distinct, compelling titles for the given content. Return ONLY a JSON array of 3 strings, no other text. Make titles specific, engaging, and optimised for the content type.",
      `Content type: ${type || "post"}\n\nContent:\n${snippet}`,
      256
    );
    let titles: string[] = [];
    try {
      titles = JSON.parse(raw);
    } catch {
      titles = raw.split("\n").filter(l => l.trim().length > 4).slice(0, 3).map(l => l.replace(/^[0-9.\-\*\s]+/, "").trim());
    }
    return res.json({ titles: titles.slice(0, 3) });
  } catch (err) {
    req.log.error({ err }, "AI titles failed");
    return res.status(500).json({ error: "Title generation unavailable" });
  }
});

router.post("/hashtags", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  if (!getAnthropicConfig()) return res.status(503).json({ error: "AI service unavailable" });
  const { content, title } = req.body;
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content required" });
  const snippet = content.slice(0, 1200);
  try {
    const raw = await callAnthropic(
      "You are a hashtag and tagging specialist for a creator platform. Generate 8-12 relevant, specific tags for the given content. Return ONLY a JSON array of strings (without # prefix), no other text. Mix broad and niche tags.",
      `Title: ${title || ""}\n\nContent:\n${snippet}`,
      200
    );
    let tags: string[] = [];
    try {
      tags = JSON.parse(raw);
    } catch {
      tags = raw.split(/[\n,]+/).map((t: string) => t.replace(/^#/, "").trim()).filter((t: string) => t.length > 1 && t.length < 40);
    }
    return res.json({ tags: tags.slice(0, 12) });
  } catch (err) {
    req.log.error({ err }, "AI hashtags failed");
    return res.status(500).json({ error: "Hashtag generation unavailable" });
  }
});

export default router;
