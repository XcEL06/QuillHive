import { useEffect, useState } from "react";
import { getStoredToken } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { TrendingUp, TrendingDown, Minus, Clock, Shield, Star, Award, MessageSquare, Heart, Share2, AlertCircle } from "lucide-react";
import { Timestamp } from "@/lib/postTimestamp";

type ReputationEvent = {
  id: string;
  eventType: string;
  scoreChange: number;
  createdAt: string;
  postId?: string;
};

const eventIcons: Record<string, React.ReactNode> = {
  post_like: <Heart className="w-3.5 h-3.5" />,
  comment_added: <MessageSquare className="w-3.5 h-3.5" />,
  post_shared: <Share2 className="w-3.5 h-3.5" />,
  post_saved: <Star className="w-3.5 h-3.5" />,
  follow_received: <Shield className="w-3.5 h-3.5" />,
  milestone: <Award className="w-3.5 h-3.5" />,
  report_received: <AlertCircle className="w-3.5 h-3.5" />,
  collaboration_success: <Star className="w-3.5 h-3.5" />,
};

export function ReputationTimeline({ userId }: { userId: string }) {
  const [events, setEvents] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();
  const t = useT();

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/trust/timeline?userId=${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const totalChange = events.reduce((sum, e) => sum + (e.scoreChange || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
        <Clock className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Loading reputation history...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t("trust.noEvents", "No reputation events yet")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-muted/50 border border-border/50 p-4">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {t("trust.totalScoreChange", "Total reputation change")}
          </p>
          <p className={`text-2xl font-bold font-mono ${totalChange >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {totalChange >= 0 ? "+" : ""}{totalChange}
          </p>
        </div>
        <div className="text-muted-foreground">
          {totalChange > 0 ? <TrendingUp className="w-8 h-8 text-emerald-500" /> :
           totalChange < 0 ? <TrendingDown className="w-8 h-8 text-rose-500" /> :
           <Minus className="w-8 h-8" />}
        </div>
      </div>

      <div className="space-y-2">
        {events.map(event => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-xl bg-card border border-border/40 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              (event.scoreChange || 0) > 0 ? "bg-emerald-500/10 text-emerald-500" :
              (event.scoreChange || 0) < 0 ? "bg-rose-500/10 text-rose-500" :
              "bg-muted text-muted-foreground"
            }`}>
              {eventIcons[event.eventType] || <Star className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground capitalize">
                {t(`trust.${event.eventType}`, event.eventType.replace(/_/g, " "))}
              </p>
              <p className="text-xs text-muted-foreground">
                <Timestamp value={event.createdAt} />
              </p>
            </div>
            <span className={`text-sm font-bold font-mono shrink-0 ${
              (event.scoreChange || 0) > 0 ? "text-emerald-500" :
              (event.scoreChange || 0) < 0 ? "text-rose-500" :
              "text-muted-foreground"
            }`}>
              {(event.scoreChange || 0) > 0 ? "+" : ""}{event.scoreChange}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
