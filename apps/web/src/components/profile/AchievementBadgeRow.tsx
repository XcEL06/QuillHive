import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import {
  Award,
  PenTool,
  FileText,
  Users,
  Crown,
  Heart,
  Flame,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface UserAchievement {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlockedAt: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  PenTool,
  FileText,
  Users,
  Crown,
  Heart,
  Flame,
  BookOpen,
};

const CATEGORY_COLOR: Record<string, string> = {
  milestone: "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/30",
  growth: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  engagement: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/30",
  consistency: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

interface Props {
  username: string;
  isMe?: boolean;
}

export default function AchievementBadgeRow({ username, isMe }: Props) {
  const [items, setItems] = useState<UserAchievement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/achievements/user/${encodeURIComponent(username)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (items === null || items.length === 0) {
    if (!isMe) return null;
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Award className="w-5 h-5 text-primary" />
          <span>No achievements yet - publish your first post to unlock one!</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Achievements</h3>
        <span className="text-xs text-muted-foreground">({items.length} unlocked)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((a) => {
          const Icon = ICON_MAP[a.icon] ?? Award;
          const color = CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.milestone;
          return (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-br border ${color} cursor-default`}
                  data-testid={`achievement-${a.key}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{a.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-muted-foreground mt-0.5">{a.description}</div>
                  <div className="text-muted-foreground/70 mt-1">
                    Unlocked <Timestamp value={a.unlockedAt} mode="date" />
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}
