import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { PostCard } from "@/components/post/PostCard";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";

interface PinnedPostsProps {
  groupId: number;
  myRole: "owner" | "admin" | "moderator" | "member" | null;
  refreshKey?: number;
}

interface PinnedPost { id: number; [key: string]: unknown }

export function PinnedPosts({ groupId, myRole, refreshKey = 0 }: PinnedPostsProps) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [pinned, setPinned] = useState<PinnedPost[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/pinned`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not load pinned posts.");
      const result = data as { pinned?: PinnedPost[] };
      setPinned(Array.isArray(result?.pinned) ? result.pinned : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load pinned posts.");
    }
  };

  useEffect(() => { void load(); }, [groupId, refreshKey, token]);

  const unpin = async (postId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/posts/${postId}/pin`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not unpin this post.");
      }
      setPinned(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      toast({ title: "Could not unpin post", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  if (loadError) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
    <p className="text-sm text-destructive">Could not load pinned posts: {loadError}</p>
    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void load()}>Retry</Button>
  </div>;
  if (pinned.length === 0) return null;

  const canModerate = myRole === "owner" || myRole === "admin" || myRole === "moderator";

  return (
    <div className="mb-6 space-y-3" data-testid="pinned-posts">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
        <Pin className="w-3.5 h-3.5" /> Pinned
      </div>
      {pinned.map(p => (
        <div key={p.id} className="relative">
          <PostCard post={p as never} />
          {canModerate && (
            <button
              onClick={() => unpin(p.id)}
              className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-background/80 border border-border hover:bg-destructive/10 hover:text-destructive"
              data-testid={`button-unpin-${p.id}`}
            >
              Unpin
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
