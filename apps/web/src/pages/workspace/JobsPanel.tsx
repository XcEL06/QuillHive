import { useState, useEffect } from 'react';
import { useGetJobs } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Briefcase, MapPin, DollarSign, Clock, Plus, Star,
  Sparkles, Zap, ChevronRight, Target,
} from 'lucide-react';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatAccountAge } from '@/lib/accountAge';
import { ReportDialog } from '@/components/report/ReportDialog';
import { ApplyOpportunityActions } from '@/components/opportunities/ApplyOpportunityActions';

type JobType = 'all' | 'job' | 'commission' | 'collaboration';

interface MatchedJob {
  id: number;
  title: string;
  description: string;
  type: string;
  skills: string[];
  compensation?: string;
  remote: boolean;
  location?: string;
  isPaid: boolean;
  companyName?: string;
  applyUrl?: string;
  applyEmail?: string;
  isFeatured?: boolean;
  featuredUntil?: string;
  viewCount?: number;
  createdAt: string;
  author: { id: number; username: string; displayName: string; avatarUrl?: string };
  matchScore: number;
  matchReasons: string[];
}

function MatchBadge({ score }: { score: number }) {
  const cfg =
    score >= 70 ? { label: `${score}% match`, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' } :
    score >= 50 ? { label: `${score}% match`, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' } :
                  { label: `${score}% match`, cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' };
  return (
    <Badge className={`border text-[10px] uppercase tracking-wider gap-1 shrink-0 ${cfg.cls}`}>
      <Target className="w-2.5 h-2.5" /> {cfg.label}
    </Badge>
  );
}

function BestMatchesSection({ matchMap }: { matchMap: Map<number, { score: number; reasons: string[] }> }) {
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/jobs/my-matches', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const jobs: MatchedJob[] = Array.isArray(data?.matches) ? data.matches : [];
        jobs.forEach(j => matchMap.set(j.id, { score: j.matchScore, reasons: j.matchReasons }));
        setMatches(jobs.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!token || (!loading && matches.length === 0)) return null;

  if (loading) return (
    <div className="mb-6">
      <Skeleton className="h-5 w-48 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0,1].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" /> Best matches for you
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matches.map(job => {
          return (
            <div key={job.id} data-card className="bg-card border border-primary/20 rounded-2xl p-4 md:p-5 hover:border-primary/50 transition-all shadow-sm group flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={`capitalize text-[10px] ${
                      job.type === 'commission'    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      job.type === 'collaboration' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' :
                                                     'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}>{job.type}</Badge>
                    <MatchBadge score={job.matchScore} />
                  </div>
                  <h4 className="font-semibold text-sm line-clamp-1">{job.title}</h4>
                </div>
                <Avatar className="w-8 h-8 rounded-lg shrink-0 border border-border">
                  <AvatarImage src={job.author.avatarUrl} />
                  <AvatarFallback className="rounded-lg text-[10px]">{job.author.displayName.slice(0,2)}</AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {job.compensation && <span className="text-accent font-medium flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{job.compensation}</span>}
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{job.remote ? 'Remote' : job.location || 'Onsite'}</span>
                </div>
                <ApplyOpportunityActions jobId={job.id} title={job.title} compact externalHref={job.applyUrl || (job.applyEmail ? `mailto:${job.applyEmail}` : undefined)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JobsPanel() {
  const { user } = useAuthStore();
  const token = getStoredToken();
  const [typeFilter, setTypeFilter] = useState<JobType>('all');
  const matchMap = new Map<number, { score: number; reasons: string[] }>();

  const { data, isLoading } = useGetJobs(
    { type: typeFilter === 'all' ? undefined : typeFilter as any },
    { request: { headers: token ? { Authorization: `Bearer ${token}` } : {} } }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Tabs value={typeFilter} onValueChange={v => setTypeFilter(v as JobType)}>
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
            <TabsTrigger value="job" className="text-xs px-2">Jobs</TabsTrigger>
            <TabsTrigger value="commission" className="text-xs px-2">Commission</TabsTrigger>
            <TabsTrigger value="collaboration" className="text-xs px-2">Collab</TabsTrigger>
          </TabsList>
        </Tabs>
        {user && (
          <Link href="/jobs/post">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Post Opportunity
            </Button>
          </Link>
        )}
      </div>

      <BestMatchesSection matchMap={matchMap} />

      <div className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-2xl p-4 md:p-5 flex gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
              <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-16" /></div>
            </div>
          </div>
        ))}

        {data?.jobs.map(job => {
          const j = job as any;
          const isFeatured = !!j.isFeatured && (!j.featuredUntil || new Date(j.featuredUntil) > new Date());
          const matchData = matchMap.get(job.id);

          return (
            <div
              key={job.id}
              className={`bg-card border rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all group flex gap-4 ${
                isFeatured
                  ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'border-border/60 hover:border-primary/40'
              }`}
            >
              <Link href={`/profile/${job.author.username}`} className="shrink-0">
                <Avatar className="w-11 h-11 rounded-xl border border-border">
                  <AvatarImage src={job.author.avatarUrl || ''} />
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xs">{job.author.displayName.substring(0,2)}</AvatarFallback>
                </Avatar>
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isFeatured && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" /> Featured
                      </Badge>
                    )}
                    <Badge variant="outline" className={`capitalize text-[10px] ${
                      job.type === 'commission'    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      job.type === 'collaboration' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' :
                                                     'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}>{job.type}</Badge>
                    {matchData && <MatchBadge score={matchData.score} />}
                  </div>
                  <ApplyOpportunityActions jobId={job.id} title={job.title} compact externalHref={j.applyUrl || (j.applyEmail ? `mailto:${j.applyEmail}` : undefined)} />
                  <ReportDialog targetType="job" targetId={job.id} label="Report" />
                </div>

                <h4 className="font-semibold text-sm mb-0.5 line-clamp-1">{job.title}</h4>
                {j.companyName && <p className="text-xs text-muted-foreground">at {j.companyName}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Posted by {job.author.displayName} · Member since {formatAccountAge(job.author.createdAt)} · Trust: {j.author.trustTier ?? 'new'}
                  {j.author.trustTier === 'new' && (
                    <span className="ml-2 font-medium text-amber-500">· New account — verify before paying anything</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{job.description}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  {j.compensation && <span className="text-foreground font-medium flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{j.compensation}</span>}
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{j.remote ? 'Remote' : j.location || 'Onsite'}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          );
        })}

        {!isLoading && !data?.jobs.length && (
          <div className="text-center py-12">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No jobs found in this category.</p>
            <Link href="/jobs/post">
              <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Post the first one
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
