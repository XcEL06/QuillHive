import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const apiUrl = process.env.API_URL || 'http://localhost:9000';
  const base: MetadataRoute.Sitemap = [
    { url: appUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${appUrl}/explore`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${appUrl}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${appUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${appUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${appUrl}/content-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
  try {
    const res = await fetch(`${apiUrl}/api/posts?limit=200&type=published`);
    if (res.ok) {
      const data = await res.json();
      const posts = (data.posts || []).map((p: { id: number; updatedAt?: string }) => ({
        url: `${appUrl}/post/${p.id}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      }));
      return [...base, ...posts];
    }
  } catch { /* return base sitemap on error */ }
  return base;
}
