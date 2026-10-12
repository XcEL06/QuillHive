import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Send, X } from "lucide-react";
import { apiRequest, apiUrl, getStoredToken, mediaUrl } from "@/lib/api";
import { formatPostTimestamp } from "@/lib/postTimestamp";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StorySpark {
  id: number;
  content: string;
  mediaUrl?: string | null;
  createdAt?: string | Date | null;
  viewCount?: number;
  likesCount?: number;
  isLiked?: boolean;
}

interface SparkComment {
  id: number;
  content: string;
  createdAt: string;
  author?: { id: number; username: string; displayName: string; avatarUrl?: string | null };
}

interface StoryGroup {
  authorId: number;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  sparks: StorySpark[];
}

export function StoryViewer({
  group,
  onClose,
}: {
  group: StoryGroup;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [comments, setComments] = useState<SparkComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const current = group.sparks[index];
  const currentTimestamp = current?.createdAt ? formatPostTimestamp(current.createdAt) : null;
  const isOwner = user?.id === group.authorId;

  useEffect(() => {
    setLikesCount(current?.likesCount ?? 0);
    setIsLiked(Boolean(current?.isLiked));
    setThreadOpen(false);
    setComments([]);
    setCommentText("");
    setCommentsError(false);
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    setViewCount(current.viewCount ?? 0);
    let active = true;
    const refreshViewCount = async () => {
      const token = getStoredToken();
      try {
        const response = await fetch(apiUrl(`/api/sparks/${current.id}/view`), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json() as { viewCount?: number };
        if (active && Number.isFinite(data.viewCount)) setViewCount(data.viewCount ?? 0);
      } catch { /* Viewer counts are best-effort. */ }
    };
    void refreshViewCount();
    const viewCountInterval = isOwner
      ? window.setInterval(() => void refreshViewCount(), 15_000)
      : null;

    return () => {
      active = false;
      if (viewCountInterval) window.clearInterval(viewCountInterval);
    };
  }, [current, isOwner]);

  useEffect(() => {
    if (!current) {
      onClose();
      return;
    }
    setProgress(0);
    if (threadOpen) return;

    const duration = 5000;
    const stepMs = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += stepMs;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (index < group.sparks.length - 1) {
          setIndex((currentIndex) => currentIndex + 1);
        } else {
          onClose();
        }
      }
    }, stepMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, group.sparks.length, index, onClose, threadOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) setIndex((currentIndex) => currentIndex - 1);
      if (event.key === "ArrowRight") {
        if (index < group.sparks.length - 1) setIndex((currentIndex) => currentIndex + 1);
        else onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [group.sparks.length, index, onClose]);

  if (!current) return null;

  const toggleLike = async () => {
    if (!user) {
      toast({ title: "Sign in to like Sparks", variant: "destructive" });
      return;
    }
    if (liking) return;
    setLiking(true);
    try {
      const response = await apiRequest("POST", `/api/posts/${current.id}/like`);
      const result = await response.json() as { liked: boolean; likesCount: number };
      setIsLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch (error) {
      toast({
        title: "Could not like Spark",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLiking(false);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    setCommentsError(false);
    try {
      const response = await apiRequest("GET", `/api/posts/${current.id}/comments`);
      setComments(await response.json() as SparkComment[]);
    } catch (error) {
      setCommentsError(true);
      toast({
        title: "Could not load Spark comments",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleThread = () => {
    if (threadOpen) {
      setThreadOpen(false);
      return;
    }
    setThreadOpen(true);
    void loadComments();
  };

  const submitComment = async () => {
    if (!user) {
      toast({ title: "Sign in to comment on Sparks", variant: "destructive" });
      return;
    }
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      await apiRequest("POST", `/api/posts/${current.id}/comments`, {
        content: commentText.trim(),
      });
      setCommentText("");
      await loadComments();
      toast({ title: "Comment posted" });
    } catch (error) {
      toast({
        title: "Could not post comment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Stories from ${group.authorDisplayName}`}
    >
      <div className="absolute left-3 right-3 top-3 z-10 flex gap-1">
        {group.sparks.map((spark, sparkIndex) => (
          <div key={spark.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: sparkIndex < index ? "100%" : sparkIndex === index ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-8 z-10 text-white"
        aria-label="Close story viewer"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="absolute left-4 top-8 z-10 flex items-center gap-2 text-white">
        <Avatar className="h-8 w-8">
          <AvatarImage src={group.authorAvatarUrl || undefined} alt={group.authorDisplayName} />
          <AvatarFallback>{group.authorDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <span className="block text-sm font-medium">{group.authorDisplayName}</span>
          {currentTimestamp && (
            <time className="block text-xs text-white/70" dateTime={currentTimestamp.dateTime} title={currentTimestamp.title}>
              {currentTimestamp.label}
            </time>
          )}
          {isOwner && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/70" aria-label={`${viewCount} viewers`}>
              <Eye className="h-3 w-3" /> {viewCount} viewer{viewCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => index > 0 && setIndex((currentIndex) => currentIndex - 1)}
        className="absolute bottom-0 left-0 top-0 flex w-1/3 items-center justify-start pl-2"
        aria-label="Previous story"
      >
        {index > 0 && <ChevronLeft className="h-6 w-6 text-white/50" />}
      </button>
      <button
        type="button"
        onClick={() => (index < group.sparks.length - 1 ? setIndex((currentIndex) => currentIndex + 1) : onClose())}
        className="absolute bottom-0 right-0 top-0 flex w-1/3 items-center justify-end pr-2"
        aria-label="Next story"
      >
        <ChevronRight className="h-6 w-6 text-white/50" />
      </button>

      <div className="w-full max-w-md px-8 text-center">
        {current.mediaUrl ? (
          <img
            src={mediaUrl(current.mediaUrl)}
            alt={current.content || "Spark media"}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        ) : (
          <p className="text-xl font-medium leading-relaxed text-white">{current.content}</p>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void toggleLike()}
          disabled={liking}
          aria-pressed={isLiked}
          className="gap-2 rounded-full bg-white/15 text-white hover:bg-white/25"
          data-testid={`spark-like-${current.id}`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? "fill-current text-rose-400" : ""}`} />
          {likesCount}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={toggleThread}
          aria-expanded={threadOpen}
          className="gap-2 rounded-full bg-white/15 text-white hover:bg-white/25"
          data-testid={`spark-comments-${current.id}`}
        >
          <MessageCircle className="h-4 w-4" />
          Comments
        </Button>
      </div>

      {threadOpen && (
        <section
          className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[58vh] w-full max-w-md flex-col rounded-t-2xl border border-white/15 bg-background text-foreground shadow-2xl"
          aria-label="Spark comments"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Comments on this Spark</h2>
            <button type="button" onClick={() => setThreadOpen(false)} aria-label="Close comments">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {loadingComments ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading comments…</p>
            ) : commentsError ? (
              <div className="py-4 text-center">
                <p className="text-sm text-destructive">Could not load comments.</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => void loadComments()}>Try again</Button>
              </div>
            ) : comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Be the first to comment.</p>
            ) : comments.map((comment) => (
              <article key={comment.id} className="flex gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.author?.avatarUrl || undefined} alt="" />
                  <AvatarFallback>{(comment.author?.displayName || comment.author?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2">
                  <p className="text-xs font-semibold">{comment.author?.displayName || comment.author?.username || "Member"}</p>
                  <p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p>
                </div>
              </article>
            ))}
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(event) => { event.preventDefault(); void submitComment(); }}
          >
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={user ? "Write a comment…" : "Sign in to comment"}
              maxLength={2000}
              rows={2}
              className="min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm"
              aria-label="Write a comment on this Spark"
            />
            <Button type="submit" size="icon" disabled={!commentText.trim() || submittingComment} aria-label="Post comment">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
