import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Twitter, Linkedin, Instagram, Facebook, MapPin, Mail, Briefcase, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getStoredToken, mediaUrl } from "@/lib/api";
import { ImageUploadField } from "@/components/media/ImageUploadField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const IDENTITY_LABELS: Record<string, string> = {
  everyone: "Member",
  reader: "Reader",
  writer: "Writer",
  artist: "Artist",
  professional: "Professional",
  student: "Student",
  builder: "Builder",
  community: "Community",
};

interface FeaturedPost {
  id: number;
  title: string | null;
  type: string;
  excerpt: string | null;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
}

interface PortfolioPayload {
  user: {
    id: number;
    displayName: string;
    username: string;
    bio: string | null;
    headline: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    website: string | null;
    twitter: string | null;
    linkedin: string | null;
    instagram: string | null;
    facebook: string | null;
    location: string | null;
    country: string | null;
    hireMeEnabled: boolean;
    showEmail: boolean;
    identityType: string | null;
    isPremium: boolean;
    isCreatorMode: boolean;
    email?: string;
  };
  featuredPosts: FeaturedPost[];
  creatorProfile: { skills: string[]; links: Array<{ label: string; url: string }> } | null;
  portfolioItems: Array<{
    id: number;
    title: string;
    description: string | null;
    mediaUrl: string;
    category: string;
    visibility: string;
    evidenceStatus: "self_reported" | "evidence_attached";
    evidenceUrl: string | null;
  }>;
  achievements: Array<{ id: number; key: string; name: string; description: string; unlockedAt: string }>;
  verifiedOutcomes: Array<{ id: number; title: string; completedAt: string | null }>;
  publishedSeries: Array<{ id: number; title: string; description: string | null; slug: string }>;
  publicChains: Array<{ id: number; title: string; description: string | null; isComplete: boolean | null }>;
  stats: { postCount: number; followerCount: number };
}

const TYPE_BG: Record<string, string> = {
  text: "from-violet-500/30 to-purple-500/30",
  poetry: "from-pink-500/30 to-rose-500/30",
  art: "from-amber-500/30 to-orange-500/30",
  story: "from-emerald-500/30 to-teal-500/30",
  essay: "from-blue-500/30 to-indigo-500/30",
};

export default function Portfolio() {
  const params = useParams<{ username?: string }>();
  const [, setLocation] = useLocation();
  const { user: viewer } = useAuthStore();
  const { toast } = useToast();
  const username = params?.username ?? viewer?.username;
  const [data, setData] = useState<PortfolioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ title: "", description: "", mediaUrl: "", evidenceUrl: "", category: "project", visibility: "public" });

  useEffect(() => {
    if (!username) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);
    const token = getStoredToken();
    fetch(`/api/users/${encodeURIComponent(username)}/portfolio`, {
      headers: token ? { Authorization: ["Bearer", token].join(" ") } : {},
    })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((payload: PortfolioPayload | null) => {
        if (payload) setData(payload);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  const addPortfolioItem = async () => {
    if (!itemForm.title.trim() || !itemForm.mediaUrl.trim()) {
      toast({ title: "Title and project image are required", variant: "destructive" });
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    setSavingItem(true);
    try {
      const response = await fetch("/api/gallery", {
        method: "POST",
        headers: { Authorization: ["Bearer", token].join(" "), "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save portfolio item");
      setData(current => current ? {
        ...current,
        portfolioItems: [{
          ...result,
          evidenceStatus: result.evidenceUrl ? "evidence_attached" : "self_reported",
        }, ...current.portfolioItems],
      } : current);
      setItemForm({ title: "", description: "", mediaUrl: "", evidenceUrl: "", category: "project", visibility: "public" });
      toast({ title: "Portfolio project added" });
    } catch (error) {
      toast({ title: "Could not add portfolio project", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !data) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-12 text-center">
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h1 className="text-2xl font-serif font-semibold mb-2">Portfolio not found</h1>
          <p className="text-muted-foreground mb-6">We couldn&apos;t find a portfolio for that username.</p>
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { user, featuredPosts, stats, portfolioItems, achievements, verifiedOutcomes, publishedSeries, publicChains } = data;
  const isMe = viewer?.username === user.username;
  const identityLabel = user.identityType && IDENTITY_LABELS[user.identityType] ? IDENTITY_LABELS[user.identityType] : "Member";

  return (
    <AppLayout>
      <div className="bg-background" data-testid="portfolio-page">
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <BackButton />
        </div>
        {user.coverUrl && (
          <div
            className="h-48 md:h-64 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-background bg-cover bg-center"
            style={{ backgroundImage: `url(${user.coverUrl})` }}
            data-testid="portfolio-cover"
          />
        )}

        <div className="max-w-5xl mx-auto px-6">
          <div className={`flex flex-col md:flex-row md:items-end gap-6 ${user.coverUrl ? "-mt-12" : "pt-12"}`}>
            <Avatar className="w-24 h-24 border-4 border-background ring-2 ring-primary/10">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
              <AvatarFallback className="text-2xl">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h1 className="text-3xl md:text-4xl font-serif font-bold" data-testid="portfolio-name">
                  {user.displayName}
                </h1>
                {user.isPremium && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Premium</Badge>}
                <Badge variant="outline">{identityLabel}</Badge>
              </div>
              {user.headline && <p className="text-base text-muted-foreground mb-2">{user.headline}</p>}
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {user.hireMeEnabled && (
                <Button
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (user.showEmail && user.email) window.location.href = `mailto:${user.email}`;
                    else setLocation(`/profile/${user.username}`);
                  }}
                  data-testid="button-hire"
                >
                  <Mail className="w-4 h-4" /> Work Together
                </Button>
              )}
              <Link href={`/profile/${user.username}`}>
                <Button variant="outline" className="rounded-xl gap-2" data-testid="button-back-to-profile">
                  View full profile
                </Button>
              </Link>
            </div>
          </div>

          {user.bio && (
            <p className="text-base leading-relaxed mt-6 max-w-3xl text-foreground/90" data-testid="portfolio-bio">
              {user.bio}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-muted-foreground">
            {user.location && (
              <span className="flex items-center gap-1.5" data-testid="portfolio-location">
                <MapPin className="w-4 h-4" /> {user.location}
                {user.country ? `, ${user.country}` : ""}
              </span>
            )}
            <span className="font-medium text-foreground">
              {stats.postCount} <span className="text-muted-foreground font-normal">Posts</span>
            </span>
            <span className="font-medium text-foreground">
              {stats.followerCount} <span className="text-muted-foreground font-normal">Followers</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {user.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="rounded-full" data-testid="link-website">
                  <Globe className="w-4 h-4" />
                </Button>
              </a>
            )}
            {user.twitter && (
              <a href={user.twitter.startsWith("http") ? user.twitter : `https://twitter.com/${user.twitter}`} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="rounded-full">
                  <Twitter className="w-4 h-4" />
                </Button>
              </a>
            )}
            {user.linkedin && (
              <a href={user.linkedin.startsWith("http") ? user.linkedin : `https://linkedin.com/in/${user.linkedin}`} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="rounded-full">
                  <Linkedin className="w-4 h-4" />
                </Button>
              </a>
            )}
            {user.instagram && (
              <a href={user.instagram.startsWith("http") ? user.instagram : `https://instagram.com/${user.instagram}`} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="rounded-full">
                  <Instagram className="w-4 h-4" />
                </Button>
              </a>
            )}
            {user.facebook && (
              <a href={user.facebook.startsWith("http") ? user.facebook : `https://facebook.com/${user.facebook}`} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="rounded-full">
                  <Facebook className="w-4 h-4" />
                </Button>
              </a>
            )}
          </div>

          {data.creatorProfile && data.creatorProfile.skills.length > 0 && (
            <section className="mt-8" aria-labelledby="portfolio-skills-heading">
              <h2 id="portfolio-skills-heading" className="mb-3 text-lg font-semibold">Self-reported skills and expertise</h2>
              <div className="flex flex-wrap gap-2">
                {data.creatorProfile.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Skills are provided by the creator; peer endorsements are separate signals, not platform verification.</p>
            </section>
          )}

          <section className="mt-10" aria-labelledby="portfolio-projects-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="portfolio-projects-heading" className="text-2xl font-serif font-semibold">Projects</h2>
                <p className="mt-1 text-xs text-muted-foreground">Creator-submitted items are self-reported unless explicitly marked as having evidence attached.</p>
              </div>
            </div>
            {isMe && (
              <div className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4">
                <h3 className="font-semibold">Add a portfolio project</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="portfolio-title">Title</Label><Input id="portfolio-title" value={itemForm.title} onChange={event => setItemForm(form => ({ ...form, title: event.target.value }))} maxLength={200} /></div>
                  <div className="space-y-1"><Label htmlFor="portfolio-category">Category</Label><Input id="portfolio-category" value={itemForm.category} onChange={event => setItemForm(form => ({ ...form, category: event.target.value }))} maxLength={80} /></div>
                </div>
                <div className="space-y-1"><Label>Project image</Label><ImageUploadField value={itemForm.mediaUrl} onChange={media => setItemForm(form => ({ ...form, mediaUrl: media }))} category="gallery" label="Upload project image" previewClassName="aspect-video" /></div>
                <div className="space-y-1"><Label htmlFor="portfolio-description">Description</Label><Textarea id="portfolio-description" value={itemForm.description} onChange={event => setItemForm(form => ({ ...form, description: event.target.value }))} maxLength={2000} /></div>
                <div className="space-y-1"><Label htmlFor="portfolio-evidence">Evidence link (optional)</Label><Input id="portfolio-evidence" value={itemForm.evidenceUrl} onChange={event => setItemForm(form => ({ ...form, evidenceUrl: event.target.value }))} maxLength={2048} placeholder="A supporting document or public reference" /><p className="text-xs text-muted-foreground">Evidence links are visible only to you. Adding a link does not mean QuillHive has reviewed or verified it.</p></div>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="portfolio-visibility">Visibility</Label>
                  <select id="portfolio-visibility" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={itemForm.visibility} onChange={event => setItemForm(form => ({ ...form, visibility: event.target.value }))}>
                    <option value="public">Public</option><option value="followers">Followers</option><option value="private">Only me</option>
                  </select>
                  <Button type="button" onClick={() => void addPortfolioItem()} disabled={savingItem}>{savingItem ? "Saving…" : "Add project"}</Button>
                </div>
              </div>
            )}
            {portfolioItems.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No portfolio projects have been added yet.</p> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {portfolioItems.map(item => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <img src={mediaUrl(item.mediaUrl)} alt="" className="aspect-video w-full object-cover" />
                    <div className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{item.category}</Badge><Badge variant="secondary">{item.evidenceStatus === "evidence_attached" ? "Evidence attached · unreviewed" : "Self-reported"}</Badge></div>
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      {isMe && item.evidenceUrl && <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View your supporting evidence</a>}
                      {!isMe && viewer && <Link href={`/messages?userId=${user.id}&contextType=project&contextId=${item.id}`}><Button type="button" size="sm" variant="outline">Discuss this project</Button></Link>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {(verifiedOutcomes.length > 0 || achievements.length > 0) && (
            <section className="mt-10 grid gap-6 md:grid-cols-2">
              {verifiedOutcomes.length > 0 && <div>
                <h2 className="mb-3 text-xl font-serif font-semibold">Verified project outcomes</h2>
                <p className="mb-3 text-xs text-muted-foreground">Shown only after both opportunity participants confirm completion in QuillHive.</p>
                <ul className="space-y-2">{verifiedOutcomes.map(outcome => <li key={outcome.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="font-medium">{outcome.title}</p><p className="text-xs text-muted-foreground">QuillHive-confirmed completion{outcome.completedAt ? ` · ${new Date(outcome.completedAt).toLocaleDateString()}` : ""}</p></li>)}</ul>
              </div>}
              {achievements.length > 0 && <div>
                <h2 className="mb-3 text-xl font-serif font-semibold">Platform achievements</h2>
                <div className="flex flex-wrap gap-2">{achievements.map(achievement => <Badge key={achievement.id} title={achievement.description} variant="outline">{achievement.name}</Badge>)}</div>
                <p className="mt-2 text-xs text-muted-foreground">Achievements are based on QuillHive activity records.</p>
              </div>}
            </section>
          )}

          {(publishedSeries.length > 0 || publicChains.length > 0) && <section className="mt-10">
            <h2 className="mb-3 text-xl font-serif font-semibold">Series and Chains</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {publishedSeries.map(series => <article key={`series-${series.id}`} className="rounded-xl border border-border p-4"><Badge variant="outline">Public Series</Badge><h3 className="mt-2 font-semibold">{series.title}</h3>{series.description && <p className="mt-1 text-sm text-muted-foreground">{series.description}</p>}</article>)}
              {publicChains.map(chain => <article key={`chain-${chain.id}`} className="rounded-xl border border-border p-4"><Badge variant="outline">{chain.isComplete ? "Completed Chain" : "Public Chain"}</Badge><h3 className="mt-2 font-semibold">{chain.title}</h3>{chain.description && <p className="mt-1 text-sm text-muted-foreground">{chain.description}</p>}</article>)}
            </div>
          </section>}

          <section className="mt-12 mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-semibold">Featured Works</h2>
              <Link href={`/profile/${user.username}`}>
                <Button variant="ghost" size="sm" className="gap-1">
                  See all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            {featuredPosts.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">
                  No published work yet.{" "}
                  {isMe && (
                    <Link href="/write" className="text-primary hover:underline">
                      Share your first post →
                    </Link>
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredPosts.map((p) => (
                  <Link key={p.id} href={`/post/${p.id}`}>
                    <article
                      className="group cursor-pointer rounded-2xl border border-border overflow-hidden bg-card hover:shadow-lg transition-all hover:-translate-y-0.5"
                      data-testid={`featured-post-${p.id}`}
                    >
                      <div
                        className={`aspect-video bg-gradient-to-br ${TYPE_BG[p.type] ?? "from-muted to-muted/50"} flex items-center justify-center`}
                        style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                      >
                        {!p.imageUrl && <span className="text-4xl opacity-50">{p.type === "art" ? "🎨" : p.type === "poetry" ? "✒️" : "📖"}</span>}
                      </div>
                      <div className="p-4">
                        <Badge variant="outline" className="text-[10px] mb-2 capitalize">
                          {p.type}
                        </Badge>
                        <h3 className="font-serif font-semibold text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                          {p.title ?? "Untitled"}
                        </h3>
                        {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
