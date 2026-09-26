interface LibraryEntry {
  slug: string;
  title: string;
  summary: string;
  body?: string | null;
  thumbnailUrl?: string | null;
  schemaType?: string | null;
  tags?: string[];
  publishedAt?: string;
  updatedAt?: string;
  authorDisplayName?: string | null;
  authorUsername?: string;
}

interface PagesContext {
  request: Request;
  env: { API_URL?: string; VITE_API_URL?: string };
  next: () => Promise<Response>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function onRequestGet({ request, env, next }: PagesContext): Promise<Response> {
  const url = new URL(request.url);
  let slug: string;
  try {
    slug = decodeURIComponent(url.pathname.slice("/library/".length));
  } catch {
    return next();
  }
  if (!slug || slug.includes("/") || slug === "new") return next();

  const shell = await next();
  if (!shell.ok || !shell.headers.get("content-type")?.includes("text/html")) return shell;

  const apiOrigin = (env.API_URL || env.VITE_API_URL || "https://quillhive.onrender.com")
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");

  try {
    const response = await fetch(`${apiOrigin}/api/library/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return shell;
    const result = await response.json() as { entry?: LibraryEntry };
    const entry = result.entry;
    if (!entry?.title || !entry.summary) return shell;

    const pageUrl = `${url.origin}/library/${encodeURIComponent(entry.slug)}`;
    const title = `${entry.title} - QuillHive Library`;
    const description = entry.summary.slice(0, 400);
    const image = entry.thumbnailUrl
      ? new URL(entry.thumbnailUrl, apiOrigin).toString()
      : `${url.origin}/logo.png`;
    const keywords = Array.isArray(entry.tags) ? entry.tags.join(", ") : "";
    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": entry.schemaType || "CreativeWork",
      headline: entry.title,
      description,
      image,
      url: pageUrl,
      datePublished: entry.publishedAt,
      dateModified: entry.updatedAt,
      keywords,
      author: {
        "@type": "Person",
        name: entry.authorDisplayName || entry.authorUsername || "QuillHive creator",
        ...(entry.authorUsername ? { url: `${url.origin}/u/${entry.authorUsername}` } : {}),
      },
    }).replace(/</g, "\\u003c");

    const metadata = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${schema}</script>`;
    const readableBody = escapeHtml(plainText(entry.body || entry.summary)).replace(/\r?\n/g, "<br />");
    const noScriptArticle = `<noscript><main><article><h1>${escapeHtml(entry.title)}</h1><p>${escapeHtml(description)}</p><div>${readableBody}</div></article></main></noscript>`;

    let html = await shell.text();
    html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<meta\s+(?:name|property)=["'](?:description|keywords|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, "");
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, "");
    html = html.replace(/<\/head>/i, () => `${metadata}\n  </head>`);
    html = html.replace(/(<div id="root"[^>]*>)/i, match => `${match}${noScriptArticle}`);

    const headers = new Headers(shell.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=300");
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
    return new Response(html, { status: shell.status, statusText: shell.statusText, headers });
  } catch {
    return shell;
  }
}