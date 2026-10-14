import { useState, useEffect } from 'react';
import { useGetJobs } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Briefcase, MapPin, DollarSign, Clock, Plus, Star, Pencil, Calendar,
  Sparkles, Zap, ChevronRight, Target, MoreHorizontal, Share2, Trash2, Flag,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Timestamp } from '@/lib/postTimestamp';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiUrl, getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ReportDialog } from '@/components/report/ReportDialog';
import { ApplyOpportunityActions } from '@/components/opportunities/ApplyOpportunityActions';
import { OpportunityShareDialog } from '@/components/opportunities/OpportunityShareDialog';

type JobType = 'all' | 'freelance' | 'micro_contract' | 'full_time' | 'collaboration' | 'syndicate_funding';

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
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = getStoredToken();

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch('/api/jobs/my-matches', { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load your best matches.');
        return response.json();
      })
      .then(data => {
        const jobs: MatchedJob[] = Array.isArray(data?.matches) ? data.matches : [];
        jobs.forEach(j => matchMap.set(j.id, { score: j.matchScore, reasons: j.matchReasons }));
        setMatches(jobs.slice(0, 4));
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Could not load your best matches.'))
      .finally(() => setLoading(false));
  }, [attempt]);

  if (!token || (!loading && matches.length === 0 && !error)) return null;

  if (loading) return (
    <div className="mb-6">
      <Skeleton className="h-5 w-48 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0,1].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center" role="alert">
      <p className="text-sm text-destructive">{error}</p>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setAttempt(value => value + 1)}>
        Retry
      </Button>
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
                <OpportunityShareDialog opportunityId={job.id} title={job.title} />
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
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const token = getStoredToken();
  const [typeFilter, setTypeFilter] = useState<JobType>('all');
  const [shareJobId, setShareJobId] = useState<number | null>(null);
  const [reportJobId, setReportJobId] = useState<number | null>(null);
  const matchMap = new Map<number, { score: number; reasons: string[] }>();

  const { data, isLoading, isError, refetch } = useGetJobs(
    { type: typeFilter === 'all' ? undefined : typeFilter as any },
    { request: { headers: token ? { Authorization: `Bearer ${token}` } : {} } }
  );
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Tabs value={typeFilter} onValueChange={v => setTypeFilter(v as JobType)}>
          <TabsList className="flex h-auto flex-wrap gap-1 text-xs">
            <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
            <TabsTrigger value="freelance" className="text-xs px-2">Freelance</TabsTrigger>
            <TabsTrigger value="micro_contract" className="text-xs px-2">Contracts</TabsTrigger>
            <TabsTrigger value="full_time" className="text-xs px-2">Full-Time</TabsTrigger>
            <TabsTrigger value="collaboration" className="text-xs px-2">Collab</TabsTrigger>
            <TabsTrigger value="syndicate_funding" className="text-xs px-2">Funding</TabsTrigger>
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

        {!isLoading && isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert">
            <p className="text-sm text-destructive">Could not load opportunities. Please try again.</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isError && jobs.map(job => {
          const j = job as any;
          const isFeatured = !!j.isFeatured && (!j.featuredUntil || new Date(j.featuredUntil) > new Date());
          const matchData = matchMap.get(job.id);
          const expiresAt = j.expiresAt ? new Date(j.expiresAt) : null;
          const isOwner = Number(job.author?.id ?? (job as any).authorId) === Number(user?.id);

          const handleDelete = async () => {
            if (!isOwner) return;
            const confirmed = window.confirm('Permanently delete this opportunity and its applications? Any related message conversations will be kept but unlinked. This cannot be undone.');
            if (!confirmed) return;
            try {
              const token = getStoredToken();
              const res = await fetch(apiUrl(`/api/jobs/${job.id}`), {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) {
                const error = await res.json().catch(() => ({ error: 'Could not delete opportunity' }));
                throw new Error(error.error || 'Could not delete opportunity');
              }
              await refetch();
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Could not delete opportunity');
            }
          };

          const handleToggleActive = async () => {
            if (!isOwner) return;
            try {
              const token = getStoredToken();
              const res = await fetch(apiUrl(`/api/jobs/${job.id}`), {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ isActive: !j.isActive }),
              });
              if (!res.ok) {
                const error = await res.json().catch(() => ({ error: 'Could not update opportunity status' }));
                throw new Error(error.error || 'Could not update opportunity status');
              }
              await refetch();
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Could not update opportunity status');
            }
          };

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
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {!j.isActive && <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">Closed</Badge>}
                  {j.moderationStatus && j.moderationStatus !== 'published' && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300">
                      {j.moderationStatus.replace(/_/g, ' ')}
                    </Badge>
                  )}
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

                <h4 className="font-semibold text-sm mb-0.5 line-clamp-1"><Link href={`/opportunities/${job.id}`}>{job.title}</Link></h4>
                {j.companyName && <p className="text-xs text-muted-foreground">at {j.companyName}</p>}

                <p className="text-xs text-muted-foreground mt-1">
                  Posted by {job.author.displayName} · Trust: {j.author.trustTier ?? 'new'}
                  {j.author.trustTier === 'new' && (
                    <span className="ml-2 font-medium text-amber-500">· New account — verify before paying anything</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{job.description}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  {j.compensation && <span className="text-foreground font-medium flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{j.compensation}</span>}
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{j.remote ? 'Remote' : j.location || 'Onsite'}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /><Timestamp value={job.createdAt} /></span>
                  {expiresAt && (
                    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <Calendar className="w-3 h-3" />Available until {expiresAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                  {isOwner ? (
                    <span className="text-xs font-medium text-muted-foreground">Your opportunity</span>
                  ) : (
                    <ApplyOpportunityActions jobId={job.id} title={job.title} compact externalHref={j.applyUrl || (j.applyEmail ? `mailto:${j.applyEmail}` : undefined)} />
                  )}
                  <div className="flex items-center gap-2">
                    {!isOwner && <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setReportJobId(job.id)}>
                      <Flag className="h-3.5 w-3.5" /> Report
                    </Button>}
                    {isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={`More actions for ${job.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => void handleToggleActive()}>
                            {j.isActive ? 'Close opportunity' : 'Reopen opportunity'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setLocation(`/jobs/post?edit=${job.id}`)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setShareJobId(job.id)}>
                            <Share2 className="h-4 w-4" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setReportJobId(job.id)}>
                            <Flag className="h-4 w-4" /> Report
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => void handleDelete()} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <OpportunityShareDialog
                    opportunityId={job.id}
                    title={job.title}
                    open={shareJobId === job.id}
                    onOpenChange={open => setShareJobId(open ? job.id : null)}
                    hideTrigger
                  />
                  <ReportDialog
                    targetType="job"
                    targetId={job.id}
                    open={reportJobId === job.id}
                    onOpenChange={open => setReportJobId(open ? job.id : null)}
                    hideTrigger
                  />
                </div>
              </div>
            </div>
          );
        })}

        {!isLoading && !isError && jobs.length === 0 && (
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
