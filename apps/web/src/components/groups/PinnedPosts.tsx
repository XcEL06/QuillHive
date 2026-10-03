import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { PostCard } from "@/components/post/PostCard";
import { useAuthStore } from "@/store/auth";

interface PinnedPostsProps {
  groupId: number;
  myRole: "owner" | "admin" | "moderator" | "member" | null;
}

interface PinnedPost { id: number; [key: string]: unknown }

export function PinnedPosts({ groupId, myRole }: PinnedPostsProps) {
  const { token } = useAuthStore();
  const [pinned, setPinned] = useState<PinnedPost[]>([]);

  const load = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/pinned`);
      if (!res.ok) return;
      const data = await res.json() as { pinned: PinnedPost[] };
      setPinned(Array.isArray(data?.pinned) ? data.pinned : []);
    } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, [groupId]);

  const unpin = async (postId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/posts/${postId}/pin`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setPinned(prev => prev.filter(p => p.id !== postId));
    } catch { /* ignore */ }
  };

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
