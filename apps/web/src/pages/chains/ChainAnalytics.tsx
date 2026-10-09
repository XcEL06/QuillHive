import { useRoute, Link } from 'wouter';
import { Timestamp } from '@/lib/postTimestamp';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ArrowLeft,
  BarChart3,
  Eye,
  Users,
  Link2,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Trophy,
} from 'lucide-react';

interface Contributor {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  count: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

interface GrowthPoint {
  date: string;
  total: number;
}

interface FunnelStage {
  link: number;
  filled: boolean;
}

interface AnalyticsData {
  chainId: number;
  chainTitle: string;
  chainCategory: string | null;
  chainCreatedAt: string;
  totalViews: number;
  totalEntries: number;
  maxEntries: number | null;
  completionRate: number | null;
  isComplete: boolean;
  contributors: Contributor[];
  dailyTimeline: DailyPoint[];
  growthCurve: GrowthPoint[];
  funnelStages: FunnelStage[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-1">
      <div className={`w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function ChainAnalytics() {
  const [, params] = useRoute('/chains/:id/analytics');
  const chainId = Number(params?.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/chains/${chainId}/analytics`],
    queryFn: () => (apiRequest('GET', `/api/chains/${chainId}/analytics`) as unknown) as Promise<AnalyticsData>,
    enabled: !isNaN(chainId),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Analytics unavailable. Only the chain creator can view this.</p>
          <Link href={`/chains/${chainId}`}>
            <Button variant="outline" className="mt-4 rounded-xl">Back to Chain</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const hasTimeline = data.dailyTimeline.length > 0;
  const hasGrowth = data.growthCurve.length > 0;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/chains/${chainId}`}>
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-xs -ml-2 mt-0.5">
              <ArrowLeft className="w-3 h-3" /> Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-serif font-bold text-foreground truncate">
                {data.chainTitle}
              </h1>
              {data.isComplete && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </Badge>
              )}
              {data.chainCategory && (
                <Badge variant="secondary" className="text-xs capitalize">{data.chainCategory}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Started <Timestamp value={data.chainCreatedAt} mode="date" />
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-primary shrink-0 mt-1" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Eye}
            label="Total Views"
            value={data.totalViews.toLocaleString()}
            color="text-blue-500"
          />
          <StatCard
            icon={Link2}
            label="Links Added"
            value={data.maxEntries ? `${data.totalEntries} / ${data.maxEntries}` : data.totalEntries}
            sub={data.completionRate !== null ? `${data.completionRate}% complete` : undefined}
            color="text-primary"
          />
          <StatCard
            icon={Users}
            label="Contributors"
            value={data.contributors.length}
            color="text-violet-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Completion"
            value={data.isComplete ? '100%' : data.completionRate !== null ? `${data.completionRate}%` : '-'}
            sub={data.isComplete ? 'Chain complete!' : 'In progress'}
            color={data.isComplete ? 'text-emerald-500' : 'text-amber-500'}
          />
        </div>

        {/* Completion funnel */}
        {data.funnelStages.length > 0 && (
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" /> Chain Progress Funnel
            </h2>
            <div className="flex items-end gap-1.5 h-24">
              {data.funnelStages.map((stage) => (
                <div key={stage.link} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      stage.filled
                        ? 'bg-primary'
                        : 'bg-muted border border-dashed border-border/60'
                    }`}
                    style={{ height: stage.filled ? '100%' : '40%' }}
                  />
                  <span className="text-[9px] text-muted-foreground">{stage.link}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {data.totalEntries} of {data.maxEntries} links filled
              {!data.isComplete && data.maxEntries && (
                <> · <span className="text-primary font-medium">{data.maxEntries - data.totalEntries} remaining</span></>
              )}
            </p>
          </div>
        )}

        {/* Daily activity bar chart */}
        {hasTimeline && (
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Daily Link Activity
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.dailyTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Links added" radius={[6, 6, 0, 0]}>
                  {data.dailyTimeline.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cumulative growth line chart */}
        {hasGrowth && data.growthCurve.length > 1 && (
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" /> Growth Over Time
            </h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data.growthCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total links"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Contributor leaderboard */}
        {data.contributors.length > 0 && (
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Contributor Leaderboard
            </h2>
            <div className="space-y-3">
              {data.contributors
                .sort((a, b) => b.count - a.count)
                .map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={c.avatar ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(c.name ?? c.username ?? '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.name ?? c.username}
                      </p>
                      {c.username && c.name && (
                        <p className="text-xs text-muted-foreground">@{c.username}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-bold text-primary">{c.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">link{c.count !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Mini bar */}
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${(c.count / Math.max(...data.contributors.map((x) => x.count))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty state - no entries yet */}
        {data.totalEntries === 0 && (
          <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No data yet - share your chain to get contributors!</p>
            <Link href={`/chains/${chainId}`}>
              <Button size="sm" className="mt-4 rounded-xl gap-2">
                <Link2 className="w-3 h-3" /> View Chain
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
