export function linkifyHashtags(html: string): string {
  return html.replace(/(?<![&\w/])#([a-zA-Z0-9_]{2,50})/g, (_match, tag: string) =>
    `<a href="/topics/${encodeURIComponent(tag.toLowerCase())}" class="text-primary hover:underline font-medium" data-hashtag="${tag}" onclick="event.stopPropagation()">#${tag}</a>`,
  );
}

export function extractHashtags(text: string): string[] {
  const clean = text.replace(/<[^>]+>/g, ' ');
  const rawMatches = clean.match(/#([a-zA-Z0-9_]{2,50})/g);
  const matches = Array.isArray(rawMatches) ? rawMatches : [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))];
}
