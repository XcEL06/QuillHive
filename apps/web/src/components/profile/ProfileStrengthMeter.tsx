import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { getStoredToken } from '@/lib/api';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeature } from '@/lib/features';

type StrengthItem = {
  label: string;
  key: string;
  done: boolean;
  points: number;
  category: string;
  tip: string;
  actionUrl: string;
};

type StrengthData = {
  score: number;
  level: string;
  levelLabel: string;
  items: StrengthItem[];
  missing: StrengthItem[];
  completed: StrengthItem[];
};

function getScoreColor(score: number) {
  if (score >= 90) return { ring: 'text-amber-500', bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' };
  if (score >= 70) return { ring: 'text-emerald-500', bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 45) return { ring: 'text-blue-500', bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' };
  return { ring: 'text-violet-500', bar: 'bg-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' };
}

export function ProfileStrengthMeter() {
  const [data, setData] = useState<StrengthData | null>(null);
  const [showAll, setShowAll] = useState(false);
  const creatorIncomeEnabled = useFeature('creator_income_enabled');

  useEffect(() => {
    setData(null);
    const token = getStoredToken();
    fetch('/api/users/me/profile-strength', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, [creatorIncomeEnabled]);

  if (!data) return null;

  const monetizationKeys = ['skills', 'endorsed', 'service', 'links', 'hire'];
  const missing = creatorIncomeEnabled
    ? data.missing
    : data.missing.filter(item => !monetizationKeys.includes(item.key));
  const completed = creatorIncomeEnabled
    ? data.completed
    : data.completed.filter(item => !monetizationKeys.includes(item.key));
  const colors = getScoreColor(data.score);
  const visibleMissing = showAll ? missing : missing.slice(0, 3);
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (data.score / 100) * circumference;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              strokeWidth="6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`${colors.ring} transition-all duration-700`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${colors.text}`}>{data.score}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className={`w-4 h-4 ${colors.ring}`} />
            <span className="font-semibold text-sm text-foreground">Profile Strength</span>
          </div>
          <p className={`text-sm font-medium ${colors.text} mb-1`}>{data.levelLabel}</p>
          <p className="text-xs text-muted-foreground">
            {missing.length === 0
              ? 'Your profile is fully optimised!'
              : `${missing.length} item${missing.length !== 1 ? 's' : ''} left to maximise visibility`}
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next steps</p>
          <div className="space-y-1.5">
            {visibleMissing.map(item => (
              <Link key={item.key} href={item.actionUrl}>
                <div className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <Circle className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0 group-hover:text-primary/50 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground">+{item.points}pts</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.tip}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {missing.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1 h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll(v => !v)}
            >
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> {missing.length - 3} more steps</>}
            </Button>
          )}
        </div>
      )}

      {completed.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none list-none flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {completed.length} completed
            <ChevronDown className="w-3 h-3 ml-auto group-open:hidden" />
            <ChevronUp className="w-3 h-3 ml-auto hidden group-open:block" />
          </summary>
          <div className="mt-1.5 space-y-1">
            {completed.map(item => (
              <div key={item.key} className="flex items-center gap-2.5 px-2.5 py-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-muted-foreground line-through">{item.label}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
