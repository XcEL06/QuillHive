import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BookOpen, X, Plus, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiUrl, getApiErrorMessage, getStoredToken } from "@/lib/api";
import { ImageUploadField } from "@/components/media/ImageUploadField";
import { BackButton } from "@/components/ui/BackButton";
import { useAuthStore } from "@/store/auth";

const CATEGORIES = [
  { key: "writing_literature", label: "📝 Writing & Literature" },
  { key: "science_research", label: "🔬 Science & Research" },
  { key: "technology_code", label: "💻 Technology & Code" },
  { key: "business_strategy", label: "📊 Business & Strategy" },
  { key: "art_design", label: "🎨 Art & Design" },
  { key: "music_audio", label: "🎵 Music & Audio" },
  { key: "film_motion", label: "🎬 Film & Motion" },
  { key: "philosophy_ideas", label: "💡 Philosophy & Ideas" },
  { key: "history_culture", label: "🏛️ History & Culture" },
  { key: "education_learning", label: "📚 Education & Learning" },
  { key: "health_wellbeing", label: "🌿 Health & Wellbeing" },
  { key: "environment_nature", label: "🌍 Environment & Nature" },
  { key: "law_society", label: "⚖️ Law & Society" },
  { key: "language_communication", label: "🗣️ Language & Communication" },
  { key: "open_reference", label: "📖 Open Reference" },
];

const CONTENT_TYPES = [
  { key: "article", label: "Article" },
  { key: "audio", label: "Audio" },
  { key: "video", label: "Video" },
  { key: "document", label: "Document" },
  { key: "collection", label: "Collection" },
  { key: "reference", label: "Reference" },
];

const LICENSES = [
  { key: "cc_by", label: "CC BY - Free with attribution" },
  { key: "cc_by_sa", label: "CC BY-SA - Share alike" },
  { key: "cc_by_nc", label: "CC BY-NC - Non-commercial" },
  { key: "cc0", label: "CC0 - Public domain" },
  { key: "all_rights_reserved", label: "© All Rights Reserved" },
];

interface FormState {
  title: string;
  summary: string;
  body: string;
  category: string;
  contentType: string;
  mediaUrl: string;
  externalUrl: string;
  thumbnailUrl: string;
  license: string;
  isPublic: boolean;
  tags: string[];
}

interface SourcePost {
  id: number;
  authorId: number;
  title?: string | null;
  content: string;
  excerpt?: string | null;
  type: string;
  imageUrl?: string | null;
  tags?: string[];
  isPublished: boolean;
  attachments?: Array<{ url?: string; mimeType?: string }>;
}

function postContentToText(content: string): string {
  return content
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

export default function AddToLibrary() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [sourcePostId, setSourcePostId] = useState<number | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");

  const [form, setForm] = useState<FormState>({
    title: "",
    summary: "",
    body: "",
    category: "open_reference",
    contentType: "article",
    mediaUrl: "",
    externalUrl: "",
    thumbnailUrl: "",
    license: "cc_by",
    isPublic: true,
    tags: [],
  });

  useEffect(() => {
    const postId = Number(new URLSearchParams(window.location.search).get("postId"));
    if (!Number.isInteger(postId) || postId <= 0) return;

    let active = true;
    setSourcePostId(postId);
    setSourceLoading(true);
    void apiFetch(`/api/posts/${postId}`)
      .then(async response => {
        if (!response.ok) throw new Error(await getApiErrorMessage(response, "Could not load the selected post."));
        const post = await response.json() as SourcePost;
        if (post.authorId !== user?.id) throw new Error("Only your own posts can be added to your Library.");
        if (!post.isPublished) throw new Error("Only published posts can be added to your Library.");

        const plainContent = postContentToText(post.content ?? "");
        const attachments = Array.isArray(post.attachments) ? post.attachments : [];
        const imageAttachment = attachments.find(item => item.mimeType?.toLowerCase().startsWith("image/"));
        const attachment = attachments.find(item =>
          /^(video|audio)\//i.test(item.mimeType ?? "") || /^(application\/pdf|text\/plain)/i.test(item.mimeType ?? ""),
        );
        const mimeType = attachment?.mimeType?.toLowerCase() ?? "";
        const contentType = mimeType.startsWith("video/") ? "video"
          : mimeType.startsWith("audio/") ? "audio"
          : mimeType ? "document" : "article";
        const summary = (post.excerpt ? postContentToText(post.excerpt) : plainContent).slice(0, 400);
        const thumbnailSource = post.imageUrl || imageAttachment?.url;
        const thumbnailUrl = thumbnailSource
          ? new URL(apiUrl(thumbnailSource), window.location.origin).toString()
          : "";
        const mediaUrl = attachment?.url
          ? new URL(apiUrl(attachment.url), window.location.origin).toString()
          : "";

        if (!active) return;
        setForm(current => ({
          ...current,
          title: post.title?.trim() || `Post #${post.id}`,
          summary: summary.length >= 10 ? summary : "A published post from my QuillHive profile.",
          body: plainContent,
          category: post.type === "artwork" ? "art_design" : contentType === "video" ? "film_motion" : "writing_literature",
          contentType,
          mediaUrl,
          externalUrl: `${window.location.origin}/post/${post.id}`,
          thumbnailUrl,
          license: "all_rights_reserved",
          isPublic: true,
          tags: Array.isArray(post.tags) ? post.tags.slice(0, 10) : [],
        }));
      })
      .catch(error => {
        if (active) setSourceError(error instanceof Error ? error.message : "Could not load the selected post.");
      })
      .finally(() => {
        if (active) setSourceLoading(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || form.tags.length >= 10 || form.tags.includes(tag)) return;
    set("tags", [...form.tags, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    set("tags", form.tags.filter(t => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.summary.trim() || !form.category) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const token = getStoredToken();
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      category: form.category,
      contentType: form.contentType,
      license: form.license,
      isPublic: form.isPublic,
      tags: form.tags,
    };
    if (form.body.trim()) body.body = form.body;
    if (form.mediaUrl.trim()) body.mediaUrl = form.mediaUrl;
    if (form.externalUrl.trim()) body.externalUrl = form.externalUrl;
    if (form.thumbnailUrl.trim()) body.thumbnailUrl = form.thumbnailUrl;

    const res = await fetch("/api/library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => null);

    setSubmitting(false);

    if (res?.ok) {
      const data = await res.json();
      toast({ title: "Entry added to the Library!" });
      setLocation(`/library/${data.entry.slug}`);
    } else {
      const err = await res?.json().catch(() => null);
      toast({
        title: "Failed to add entry",
        description: err?.error?.fieldErrors
          ? Object.values(err.error.fieldErrors).flat().join(", ")
          : "Please check your inputs and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <BackButton fallback="/library" />
        {sourceLoading && <p className="mb-4 text-sm text-muted-foreground">Loading your post…</p>}
        {sourceError && <p role="alert" className="mb-4 text-sm text-destructive">{sourceError}</p>}
        {sourcePostId && !sourceLoading && !sourceError && (
          <p className="mb-4 text-sm text-muted-foreground">Prefilled from your post. Publishing here creates a separate public Library entry.</p>
        )}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-primary/10 rounded-xl">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Add to Library</h1>
            <p className="text-muted-foreground text-sm">
              Your contribution will be publicly indexed and credited to you.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              maxLength={200}
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="A clear, descriptive title for your entry"
              required
            />
            <p className="text-xs text-muted-foreground">{form.title.length}/200</p>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="summary">
              Summary <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-2">(used as meta description by search engines)</span>
            </Label>
            <Textarea
              id="summary"
              maxLength={400}
              rows={3}
              value={form.summary}
              onChange={e => set("summary", e.target.value)}
              placeholder="1–3 sentences describing what this entry covers..."
              required
            />
            <p className="text-xs text-muted-foreground">{form.summary.length}/400</p>
          </div>

          {/* Category & Content Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Content Type <span className="text-destructive">*</span></Label>
              <Select value={form.contentType} onValueChange={v => set("contentType", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">
              Body Content <span className="text-muted-foreground text-xs">(optional, for articles)</span>
            </Label>
            <Textarea
              id="body"
              rows={8}
              value={form.body}
              onChange={e => set("body", e.target.value)}
              placeholder="Write your full article content here..."
              className="font-mono text-sm"
            />
          </div>

          {/* Media URL */}
          <div className="space-y-1.5">
            <Label htmlFor="mediaUrl">
              Media URL <span className="text-muted-foreground text-xs">(audio/video/document link)</span>
            </Label>
            <Input
              id="mediaUrl"
              type="url"
              value={form.mediaUrl}
              onChange={e => set("mediaUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* External URL */}
          <div className="space-y-1.5">
            <Label htmlFor="externalUrl">
              External Source URL <span className="text-muted-foreground text-xs">(optional link)</span>
            </Label>
            <Input
              id="externalUrl"
              type="url"
              value={form.externalUrl}
              onChange={e => set("externalUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-1.5">
            <ImageUploadField value={form.thumbnailUrl} onChange={thumbnailUrl => set("thumbnailUrl", thumbnailUrl)} category="library" label="Choose thumbnail (optional)" />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag..."
                maxLength={50}
                disabled={form.tags.length >= 10}
              />
              <Button type="button" variant="outline" onClick={addTag} disabled={form.tags.length >= 10}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* License */}
          <div className="space-y-1.5">
            <Label>License</Label>
            <Select value={form.license} onValueChange={v => set("license", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSES.map(l => (
                  <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Public - indexed by search engines</p>
                <p className="text-xs text-muted-foreground">
                  {form.isPublic
                    ? "Google and other search engines can index this entry. Your name will be credited."
                    : "This entry will NOT be indexed by search engines or visible to non-logged-in users."}
                </p>
              </div>
            </div>
            <Switch
              checked={form.isPublic}
              onCheckedChange={v => set("isPublic", v)}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting || sourceLoading} className="flex-1">
              {submitting ? "Publishing..." : "Publish to Library"}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
