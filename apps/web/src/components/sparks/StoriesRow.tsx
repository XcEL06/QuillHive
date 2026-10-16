import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { apiUrl, getStoredToken } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface StoryGroup {
  authorId: number;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  sparks: Array<{ id: number; content: string; mediaUrl?: string | null; createdAt?: string; viewCount?: number; viewed?: boolean }>;
  hasUnviewed: boolean;
}

export function StoriesRow({ onOpenViewer }: { onOpenViewer: (group: StoryGroup) => void }) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [, navigate] = useLocation();

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    const loadStories = async () => {
      try {
        const response = await fetch(apiUrl("/api/sparks/active"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error("Could not load Sparks");
        const data = await response.json();
        if (active) setGroups(Array.isArray(data?.stories) ? data.stories : []);
      } catch {
        if (active) setGroups([]);
      }
    };
    void loadStories();
    const refreshInterval = window.setInterval(() => void loadStories(), 15_000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-3 scrollbar-hide" aria-label="Stories">
      <button
        type="button"
        onClick={() => navigate("/sparks/new")}
        className="flex shrink-0 flex-col items-center gap-1"
        aria-label="Add spark"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className="text-[11px] text-muted-foreground">Add</span>
      </button>

      {groups.map((group) => (
        <button
          type="button"
          key={group.authorId}
          onClick={() => onOpenViewer(group)}
          className="flex shrink-0 flex-col items-center gap-1"
          aria-label={`View stories from ${group.authorDisplayName}`}
        >
          <div
            className={`h-14 w-14 rounded-full p-[2px] ${
              group.hasUnviewed
                ? "bg-gradient-to-tr from-violet-700 via-primary to-amber-400"
                : "bg-muted"
            }`}
          >
            <Avatar className="h-full w-full rounded-full border-2 border-background">
              <AvatarImage src={group.authorAvatarUrl || undefined} alt={group.authorDisplayName} />
              <AvatarFallback>{group.authorDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <span className="max-w-[56px] truncate text-[11px] text-foreground">
            {group.authorDisplayName}
          </span>
        </button>
      ))}
    </div>
  );
}

export type { StoryGroup };
