import { useCallback, useEffect } from "react";
import { useSocketEvent } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";
import { useLocation } from "wouter";
import {
  Heart, MessageCircle, UserPlus, AtSign, Users, AlertCircle,
  Info, Zap, Trophy, TrendingUp, Bookmark, Star, BookOpen, BadgeCheck,
} from "lucide-react";
import { OFFICIAL_NOTICE_WARNING } from "@/lib/official-notice";

interface NotificationPayload {
  id: number;
  type: string;
  message: string;
  category: string;
  postId?: number | null;
  groupId?: number | null;
  url?: string | null;
  actor?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

function getNotifIcon(type: string): React.ReactNode {
  const cls = "w-4 h-4";
  switch (type) {
    case "like": return <Heart className={`${cls} text-rose-500 fill-current`} />;
    case "comment":
    case "reply": return <MessageCircle className={`${cls} text-blue-500`} />;
    case "follow": return <UserPlus className={`${cls} text-primary`} />;
    case "mention": return <AtSign className={`${cls} text-amber-500`} />;
    case "group_invite": return <Users className={`${cls} text-emerald-500`} />;
    case "admin_action": return <AlertCircle className={`${cls} text-rose-600`} />;
    case "official_notice": return <BadgeCheck className={`${cls} text-amber-600`} />;
    case "system": return <Info className={`${cls} text-violet-500`} />;
    case "achievement":
    case "milestone":
    case "streak_milestone": return <Trophy className={`${cls} text-amber-500`} />;
    case "trending":
    case "trending_notif": return <TrendingUp className={`${cls} text-emerald-500`} />;
    case "library_save": return <Bookmark className={`${cls} text-violet-500`} />;
    case "library_feature": return <Star className={`${cls} text-amber-400`} />;
    case "library_entry": return <BookOpen className={`${cls} text-indigo-500`} />;
    default: return <Zap className={`${cls} text-muted-foreground`} />;
  }
}

function getNotifLink(notif: NotificationPayload): string {
  if (notif.type === "follow" && notif.actor?.username) {
    return `/profile/${notif.actor.username}`;
  }
  if ((notif.type === "group_invite" || notif.type.startsWith("group_")) && notif.groupId) return `/groups/${notif.groupId}`;
  if (["like", "comment", "comment_like", "reply", "mention", "quote", "share", "highlight"].includes(notif.type) && notif.postId) return `/post/${notif.postId}`;
  if (notif.url?.startsWith("/") && !notif.url.startsWith("//")) return notif.url;
  if (notif.postId) return `/post/${notif.postId}`;
  if (notif.groupId) return `/groups/${notif.groupId}`;
  if (notif.type.startsWith("library_")) return "/library";
  return "/notifications";
}

export function NotificationToast() {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [location] = useLocation();

  const shouldSkip = location.startsWith("/notifications");

  const handleNotif = useCallback(
    (data: NotificationPayload) => {
      if (shouldSkip) return;
      if (!data || !data.type) return;

      const link = getNotifLink(data);
      const actorName = data.actor?.displayName || data.actor?.username || "";
      const isOfficialNotice = data.type === "official_notice";
      const title = isOfficialNotice
        ? <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-100"><BadgeCheck className="h-4 w-4" /> Official QuillHive notice</span>
        : actorName ? `${actorName}` : "QuillHive";
      const description = isOfficialNotice
        ? <div className="space-y-2"><p>{data.message}</p><p className="border-t border-amber-500/20 pt-2 text-xs text-amber-900/80 dark:text-amber-100/80">{OFFICIAL_NOTICE_WARNING}</p></div>
        : data.message;

      toast({
        title,
        description,
        className: isOfficialNotice
          ? "border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-50"
          : undefined,
        duration: 4000,
        action: link
          ? {
              altText: "View",
              onClick: () => {
                window.location.href = link;
              },
            } as any
          : undefined,
      });
    },
    [shouldSkip, toast],
  );

  useSocketEvent<NotificationPayload>("notification:new", handleNotif);

  useEffect(() => {
    if (!isAuthenticated) return;
  }, [isAuthenticated]);

  return null;
}
