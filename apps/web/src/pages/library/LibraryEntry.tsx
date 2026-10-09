import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye, Bookmark, BookMarked, ExternalLink, Share2, FileText,
  Headphones, Video, FolderOpen, BookOpen, ChevronRight, Link as LinkIcon,
  Calendar, RefreshCw,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { safeHtml } from "@/lib/sanitize";
import { getStoredToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/ui/BackButton";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { Timestamp } from "@/lib/postTimestamp";

interface LibraryEntryFull {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string | null;
  category: string;
  contentType: string;
  tags: string[];
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  license: string;
  schemaType: string;
  viewCount: number;
  saveCount: number;
  downloadCount: number;
  isFeatured: boolean;
  isPublic: boolean;
  publishedAt: string;
  updatedAt: string;
  authorId: number;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorHeadline: string | null;
  authorBio: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  writing_literature: "📝 Writing & Literature",
  science_research: "🔬 Science & Research",
  technology_code: "💻 Technology & Code",
  business_strategy: "📊 Business & Strategy",
  art_design: "🎨 Art & Design",
  music_audio: "🎵 Music & Audio",
  film_motion: "🎬 Film & Motion",
  philosophy_ideas: "💡 Philosophy & Ideas",
  history_culture: "🏛️ History & Culture",
  education_learning: "📚 Education & Learning",
  health_wellbeing: "🌿 Health & Wellbeing",
  environment_nature: "🌍 Environment & Nature",
  law_society: "⚖️ Law & Society",
  language_communication: "🗣️ Language & Communication",
  open_reference: "📖 Open Reference",
};

const LICENSE_LABELS: Record<string, string> = {
  cc_by: "CC BY",
  cc_by_sa: "CC BY-SA",
  cc_by_nc: "CC BY-NC",
  cc0: "CC0 Public Domain",
  all_rights_reserved: "© All Rights Reserved",
};

function ContentTypeIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  switch (type) {
    case "audio": return <Headphones className={cls} />;
    case "video": return <Video className={cls} />;
    case "document": return <FileText className={cls} />;
    case "collection": return <FolderOpen className={cls} />;
    case "reference": return <LinkIcon className={cls} />;
    default: return <BookOpen className={cls} />;
  }
}

export default function LibraryEntry() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const t = useT();
  const [entry, setEntry] = useState<LibraryEntryFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [moreEntries, setMoreEntries] = useState<LibraryEntryFull[]>([]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    const token = getStoredToken();
    fetch(`/api/library/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        setEntry(d.entry);
        document.title = `${d.entry.title} - QuillHive Library`;
        // fetch more by same author
        return fetch(
          `/api/library?category=${d.entry.category}&limit=4`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
      })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.entries) {
          setMoreEntries(d.entries.filter((e: LibraryEntryFull) => e.slug !== slug).slice(0, 3));
        }
      })
      .catch(err => {
        if (err === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function toggleSave() {
    if (!isAuthenticated) {
      toast({ title: "Sign in to save entries", variant: "destructive" });
      return;
    }
    if (!entry || savingToggle) return;
    setSavingToggle(true);
    const token = getStoredToken();
    const res = await fetch(`/api/library/${entry.id}/save`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setSaved(d.saved);
      toast({ title: d.saved ? "Saved to library" : "Removed from saves" });
    }
    setSavingToggle(false);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: entry?.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link copied to clipboard" });
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !entry) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Entry not found</h2>
          <p className="text-muted-foreground text-sm mt-1">
            It may have been removed or made private.
          </p>
          <Button asChild className="mt-4">
            <Link href="/library">Browse Library</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BackButton fallback="/library" />
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link href="/library" className="hover:text-foreground transition-colors">
            Library
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="hover:text-foreground cursor-pointer" onClick={() => window.location.href = `/library?category=${entry.category}`}>
            {CATEGORY_LABELS[entry.category] ?? entry.category}
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground line-clamp-1 max-w-[200px]">{entry.title}</span>
        </nav>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-serif font-bold leading-tight mb-4">
          {entry.title}
        </h1>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {entry.isFeatured && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0">
              ⭐ Featured
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1">
            <ContentTypeIcon type={entry.contentType} />
            {entry.contentType.charAt(0).toUpperCase() + entry.contentType.slice(1)}
          </Badge>
          <Badge variant="outline">{CATEGORY_LABELS[entry.category] ?? entry.category}</Badge>
          <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
            {LICENSE_LABELS[entry.license] ?? entry.license}
          </span>
        </div>

        {/* Thumbnail */}
        {entry.thumbnailUrl && (
          <img
            src={entry.thumbnailUrl}
            alt={entry.title}
            className="w-full max-h-72 object-cover rounded-2xl mb-6"
          />
        )}

        {/* Author card */}
        <div className="flex items-start gap-3 bg-muted/40 rounded-2xl p-4 mb-6">
          <Avatar className="h-11 w-11 shrink-0">
            {entry.authorAvatarUrl && (
              <AvatarImage src={entry.authorAvatarUrl} alt={entry.authorDisplayName} />
            )}
            <AvatarFallback>
              {getInitials(entry.authorDisplayName || entry.authorUsername)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{entry.authorDisplayName || entry.authorUsername}</p>
            {entry.authorHeadline && (
              <p className="text-sm text-muted-foreground truncate">{entry.authorHeadline}</p>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/profile/${entry.authorUsername}`}>View Profile</Link>
          </Button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Published <Timestamp value={entry.publishedAt} mode="date" />
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Updated <Timestamp value={entry.updatedAt} />
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> {entry.viewCount} views
          </span>
          <span className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5" /> {entry.saveCount} saves
          </span>
        </div>

        {/* Tags */}
        {Array.isArray(entry.tags) && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(entry.tags as string[]).map(tag => (
              <Link
                key={tag}
                href={`/library?q=${encodeURIComponent(tag)}`}
                className="text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-2.5 py-1 rounded-full"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <Separator className="mb-6" />

        {/* Media content */}
        {entry.contentType === "audio" && entry.mediaUrl && (
          <div className="mb-6 bg-muted rounded-2xl p-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Headphones className="w-4 h-4" /> Audio
            </p>
            <audio controls className="w-full" src={entry.mediaUrl}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {entry.contentType === "video" && entry.mediaUrl && (
          <div className="mb-6 rounded-2xl overflow-hidden">
            <video controls className="w-full max-h-96" src={entry.mediaUrl}>
              Your browser does not support video playback.
            </video>
          </div>
        )}

        {entry.contentType === "document" && entry.mediaUrl && (
          <div className="mb-6">
            <Button asChild variant="outline" className="gap-2">
              <a href={entry.mediaUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="w-4 h-4" /> Open Document
              </a>
            </Button>
          </div>
        )}

        {entry.externalUrl && (
          <div className="mb-6">
            <Button asChild variant="outline" className="gap-2">
              <a href={entry.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" /> Visit Source →
              </a>
            </Button>
          </div>
        )}

        {/* Body */}
        {entry.body && (
          <div
            className="prose prose-neutral dark:prose-invert max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: safeHtml(entry.body) }}
          />
        )}

        <Separator className="mb-6" />

        {/* Actions */}
        <div className="flex items-center gap-3 mb-10">
          <Button
            onClick={toggleSave}
            disabled={savingToggle}
            variant={saved ? "default" : "outline"}
            className="gap-2"
          >
            {saved ? (
              <><BookMarked className="w-4 h-4" /> Saved ✓</>
            ) : (
              <><Bookmark className="w-4 h-4" /> Save to Library</>
            )}
          </Button>
          <Button onClick={handleShare} variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" /> Share
          </Button>
        </div>

        {/* More from this category */}
        {moreEntries.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">More in this category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {moreEntries.map(e => (
                <Link
                  key={e.id}
                  href={`/library/${e.slug}`}
                  className="flex flex-col bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors group"
                >
                  <span className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors mb-1">
                    {e.title}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1">{e.summary}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
