import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Briefcase, CheckCircle2, Circle, ExternalLink, Sparkles, Target } from "lucide-react";
import { getStoredToken } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Factor {
  label: string;
  done: boolean;
  impact: "high" | "medium" | "low";
}

interface OpportunityData {
  score: number;
  label: string;
  factors: Factor[];
  tips: string[];
}

const IMPACT_COLORS: Record<"high" | "medium" | "low", string> = {
  high:   "text-rose-500",
  medium: "text-amber-500",
  low:    "text-slate-400",
};

const SCORE_CONFIG = (score: number) => {
  if (score >= 80) return { color: "#10b981", bg: "from-emerald-500/15 to-teal-500/5", badgeClass: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-400/30" };
  if (score >= 60) return { color: "#3b82f6", bg: "from-blue-500/15 to-indigo-500/5",  badgeClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-400/30" };
  if (score >= 40) return { color: "#f59e0b", bg: "from-amber-500/15 to-yellow-500/5", badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-400/30" };
  return { color: "#94a3b8", bg: "from-slate-500/10 to-gray-500/5", badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300/50" };
};

export function OpportunityPanel() {
  const [data, setData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();
  const token = getStoredToken();

  useEffect(() => {
    fetch("/api/analytics/opportunity-readiness", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-5"><Skeleton className="h-48 w-full rounded-xl" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const cfg = SCORE_CONFIG(data.score);
  const factors = Array.isArray(data.factors) ? data.factors : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const doneCount = factors.filter(f => f.done).length;

  return (
    <Card className={`rounded-2xl border-border/60 bg-gradient-to-br ${cfg.bg} overflow-hidden`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4" style={{ color: cfg.color }} />
            {t("dashboard.opportunityReadiness", "Opportunity Readiness")}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] font-semibold border rounded-full ${cfg.badgeClass}`}>
            {data.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" style={{ color: cfg.color }}>{data.score}%</span>
              <span className="text-xs text-muted-foreground">{doneCount}/{factors.length} {t("dashboard.factorsComplete", "factors complete")}</span>
            </div>
            <Progress value={data.score} className="h-2" style={{ "--progress-color": cfg.color } as React.CSSProperties} />
          </div>
        </div>

        <div className="space-y-2">
          {factors.map((factor, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {factor.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                : <Circle className={`w-4 h-4 shrink-0 ${IMPACT_COLORS[factor.impact]}`} />
              }
              <span className={`text-xs flex-1 ${factor.done ? "text-foreground" : "text-muted-foreground"}`}>
                {factor.label}
              </span>
              {!factor.done && (
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${
                  factor.impact === "high" ? "border-rose-400/40 text-rose-500" :
                  factor.impact === "medium" ? "border-amber-400/40 text-amber-500" :
                  "border-slate-400/40 text-slate-400"
                }`}>
                  {factor.impact}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {tips.length > 0 && (
          <div className="rounded-xl bg-background/50 border border-border/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Target className="w-3 h-3" /> {t("dashboard.nextSteps", "Next Steps")}
            </p>
            {tips.map((tip, i) => (
              <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" /> {tip}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <Link href="/settings">
            <Button size="sm" variant="outline" className="w-full h-8 text-xs rounded-xl gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> {t("dashboard.editProfile", "Edit Profile")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
