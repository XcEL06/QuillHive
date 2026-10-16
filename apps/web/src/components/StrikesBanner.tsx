import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/lib/i18n";

interface Strike {
  id: number;
  reason: string;
  severity: number;
  createdAt: string;
  acknowledgedAt: string | null;
  appealStatus: string;
}

export function StrikesBanner() {
  const t = useT();
  const { token } = useAuthStore();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealError, setAppealError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/strikes/me/unacknowledged", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { strikes: Strike[] };
      setStrikes(Array.isArray(data?.strikes) ? data.strikes : []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const acknowledge = useCallback(async (id: number) => {
    if (!token) return;
    setLoading(true);
    try {
      await fetch(`/api/strikes/${id}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStrikes((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const submitAppeal = useCallback(async (id: number) => {
    if (!token || appealText.trim().length < 10) {
      setAppealError("Please explain your appeal in at least 10 characters.");
      return;
    }
    setLoading(true);
    setAppealError("");
    try {
      const response = await fetch(`/api/strikes/${id}/appeal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ appealText }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Could not submit appeal.");
      setStrikes((current) => current.map((strike) => strike.id === id ? { ...strike, appealStatus: "pending" } : strike));
      setAppealText("");
    } catch (error) {
      setAppealError(error instanceof Error ? error.message : "Could not submit appeal.");
    } finally {
      setLoading(false);
    }
  }, [appealText, token]);

  if (strikes.length === 0) return null;
  const top = strikes[0];

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-300 dark:border-amber-800/60" data-testid="banner-strikes">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {strikes.length > 1
              ? t("strikes.bannerMultiple", `You have ${strikes.length} active strikes`)
              : t("strikes.bannerSingle")}
          </p>
          <p className="text-amber-800 dark:text-amber-300/90 mt-0.5 line-clamp-2">{top.reason}</p>
          {top.appealStatus === "none" ? (
            <div className="mt-3 max-w-2xl space-y-2">
              <Textarea
                value={appealText}
                onChange={(event) => setAppealText(event.target.value)}
                maxLength={2000}
                rows={2}
                aria-label="Appeal this moderation strike"
                placeholder="Explain why this strike should be reviewed"
              />
              {appealError && <p role="alert" className="text-xs text-destructive">{appealError}</p>}
              <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void submitAppeal(top.id)}>
                Submit appeal
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs">Appeal status: {top.appealStatus.replace(/_/g, " ")}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void acknowledge(top.id)}
          disabled={loading}
          className="shrink-0"
          data-testid="button-acknowledge-strike"
        >
          <X className="w-3.5 h-3.5 mr-1" /> {t("strikes.acknowledge")}
        </Button>
      </div>
    </div>
  );
}
