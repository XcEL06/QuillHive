import { useState, useEffect } from 'react';
import { useGetJobs, GetJobsType } from '@workspace/api-client-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Briefcase, MapPin, DollarSign, Clock, Plus, Star,
  Eye, Users, Sparkles, Zap, ChevronRight, Target,
} from 'lucide-react';
import { Link as WouterLink } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatAccountAge } from '@/lib/accountAge';
import { ReportDialog } from '@/components/report/ReportDialog';
import { ApplyOpportunityActions } from '@/components/opportunities/ApplyOpportunityActions';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface HireableCreator {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  headline?: string;
  identityType?: string;
  followerCount?: number;
}

// ── Score badge ───────────────────────────────────────────────────────────────

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

// ── Best Matches for You ──────────────────────────────────────────────────────

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

  if (!token) return null;
  if (loading) return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );
  if (matches.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Best matches for you
        </h2>
        <span className="text-xs text-muted-foreground">Based on your skills &amp; topics</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matches.map(job => {
          return (
            <div key={job.id} data-card className="bg-card border border-primary/20 rounded-2xl p-4 md:p-5 hover:border-primary/50 transition-all shadow-sm group flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className={`capitalize text-[10px] ${
                      job.type === 'commission'    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      job.type === 'collaboration' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' :
                                                     'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}>{job.type}</Badge>
                    <MatchBadge score={job.matchScore} />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{job.title}</h3>
                  {job.companyName && <p className="text-xs text-muted-foreground">at {job.companyName}</p>}
                </div>
                <Link href={`/profile/${job.author.username}`}>
                  <Avatar className="w-8 h-8 rounded-lg shrink-0 border border-border">
                    <AvatarImage src={job.author.avatarUrl} />
                    <AvatarFallback className="rounded-lg text-[10px]">{job.author.displayName.slice(0,2)}</AvatarFallback>
                  </Avatar>
                </Link>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
              {job.matchReasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.matchReasons.slice(0, 2).map(r => (
                    <span key={r} className="inline-flex items-center gap-1 text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5" /> {r}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-auto pt-1">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

// ── Creator board ─────────────────────────────────────────────────────────────

function AvailableCreatorsBoard() {
  const [creators, setCreators] = useState<HireableCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();

  useEffect(() => {
    fetch('/api/users/hireable?limit=6', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => setCreators(Array.isArray(data) ? data : Array.isArray(data?.creators) ? data.creators : []))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && creators.length === 0) return null;

  const IDENTITY_LABELS: Record<string, string> = {
    writer: 'Writer', artist: 'Artist', builder: 'Builder',
    professional: 'Professional', student: 'Student', community: 'Community',
  };

  return (
    <div className="mt-14">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Creators open for work
        </h2>
        <Link href="/explore" className="text-sm text-primary hover:underline flex items-center gap-1">
          Browse all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        {!loading && creators.map(creator => (
          <div key={creator.id} data-card className="bg-card border border-border/60 rounded-2xl p-4 md:p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors group">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${creator.username}`}>
                <Avatar className="w-12 h-12 border border-border group-hover:border-primary/40 transition-colors">
                  <AvatarImage src={creator.avatarUrl} />
                  <AvatarFallback>{(creator.displayName || creator.username).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link href={`/profile/${creator.username}`} className="font-semibold text-sm hover:text-primary transition-colors block truncate">
                    {creator.displayName || creator.username}
                  </Link>
                  {creator.identityType && creator.identityType !== 'everyone' && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                      {IDENTITY_LABELS[creator.identityType] ?? creator.identityType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">@{creator.username}</p>
              </div>
            </div>
            {(creator.headline || creator.bio) && (
              <p className="text-sm text-muted-foreground line-clamp-2">{creator.headline || creator.bio}</p>
            )}
            <div className="mt-auto">
              <Link href={`/profile/${creator.username}`}>
                <Button size="sm" variant="outline" className="w-full rounded-lg">View Profile</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Jobs() {
  const [activeType, setActiveType] = useState<GetJobsType>(null);
  const { data, isLoading } = useGetJobs({ type: activeType });
  const { user } = useAuthStore();
  const matchMap = new Map<number, { score: number; reasons: string[] }>();
  const token = getStoredToken();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-0">

        {/* Hero */}
        <div className="bg-card border border-border/60 rounded-3xl p-8 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 max-w-xl">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">Collaboration &amp; Jobs</h1>
            <p className="text-muted-foreground text-lg">Find commissions, freelance gigs, or co-authors for your next big project.</p>
            {user && (
              <p className="text-sm text-primary mt-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Opportunities are ranked by how well they match your profile
              </p>
            )}
          </div>
          <WouterLink href="/jobs/post">
            <Button className="shrink-0 rounded-xl h-12 px-6 shadow-lg shadow-primary/20 gap-2 relative z-10 min-h-[44px]">
              <Plus className="w-5 h-5" /> Post Opportunity
            </Button>
          </WouterLink>
        </div>

        {/* Best matches section (logged-in only) */}
        {token && <BestMatchesSection matchMap={matchMap} />}

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Tabs value={activeType || 'all'} onValueChange={v => setActiveType(v === 'all' ? null : v as GetJobsType)}>
            <TabsList className="bg-muted/50 p-1 rounded-xl inline-flex overflow-x-auto hide-scrollbar">
              <TabsTrigger value="all" className="rounded-lg min-h-[36px]">All</TabsTrigger>
              <TabsTrigger value="job" className="rounded-lg min-h-[36px]">Jobs</TabsTrigger>
              <TabsTrigger value="collaboration" className="rounded-lg min-h-[36px]">Collabs</TabsTrigger>
              <TabsTrigger value="commission" className="rounded-lg min-h-[36px]">Commissions</TabsTrigger>
            </TabsList>
          </Tabs>
          <WouterLink href="/opportunities/search">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 min-h-[44px] text-xs">
              <Users className="w-3.5 h-3.5" /> Scout Talent
            </Button>
          </WouterLink>
        </div>

        {/* Job list */}
        <div className="space-y-4">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-2xl p-4 md:p-5 flex gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="space-y-3 w-full">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <div className="flex gap-2 pt-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-20" /></div>
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
                className={`bg-card border rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-5 ${
                  isFeatured
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/[0.04] to-transparent ring-1 ring-amber-500/20'
                    : 'border-border/60 hover:border-primary/40'
                }`}
                data-testid={`job-${job.id}`}
              >
                <Link href={`/profile/${job.author.username}`} className="shrink-0">
                  <Avatar className="w-14 h-14 rounded-xl border border-border group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={job.author.avatarUrl || ''} />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary">{job.author.displayName.substring(0,2)}</AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {isFeatured && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-wider gap-1">
                            <Star className="w-3 h-3 fill-current" /> Featured
                          </Badge>
                        )}
                        <Badge variant="outline" className={`capitalize ${
                          job.type === 'commission'    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          job.type === 'collaboration' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' :
                                                         'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        }`}>{job.type}</Badge>
                        {matchData && matchData.score >= 30 && (
                          <Badge className={`border text-[10px] uppercase tracking-wider gap-1 shrink-0 ${
                            matchData.score >= 70 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                            matchData.score >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' :
                                                    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          }`}>
                            <Target className="w-2.5 h-2.5" /> {matchData.score}% fit
                          </Badge>
                        )}
                        {j.companyName && (
                          <span className="text-xs text-muted-foreground">at <span className="font-medium text-foreground">{j.companyName}</span></span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Posted by <Link href={`/profile/${job.author.username}`} className="text-foreground hover:underline font-medium">{job.author.displayName}</Link> · Member since {formatAccountAge(job.author.createdAt)} · Trust: {j.author.trustTier ?? 'new'}
                        {j.author.trustTier === 'new' && (
                          <span className="ml-2 font-medium text-amber-500">· New account — verify before paying anything</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0 bg-muted px-2.5 py-1 rounded-md">
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(job.createdAt))} ago
                    </span>
                  </div>

                  <p className="text-foreground/80 text-sm mb-3 line-clamp-2 mt-2">{job.description}</p>

                  {/* Match reasons pill row */}
                  {matchData && matchData.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {matchData.reasons.slice(0, 3).map(r => (
                        <span key={r} className="inline-flex items-center gap-1 text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full">
                          <Zap className="w-2.5 h-2.5" /> {r}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-sm">
                    {job.compensation && (
                      <div className="flex items-center gap-1.5 font-medium text-accent">
                        <DollarSign className="w-4 h-4" /> {job.compensation}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-4 h-4" /> {job.remote ? 'Remote' : j.location || 'Not specified'}
                    </div>
                    {(j.viewCount ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" /> {j.viewCount}
                      </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto flex-wrap justify-end w-full sm:w-auto">
                      {job.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && <span className="text-xs text-muted-foreground">+{job.skills.length - 3}</span>}
                      <ApplyOpportunityActions jobId={job.id} title={job.title} compact externalHref={j.applyUrl || (j.applyEmail ? `mailto:${j.applyEmail}` : undefined)} />
                      <ReportDialog targetType="job" targetId={job.id} label="Report" className="min-h-[44px]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {data?.jobs.length === 0 && !isLoading && (
            <div className="text-center py-20 border border-dashed border-border rounded-3xl">
              <Briefcase className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">No opportunities found</h3>
              <p className="text-muted-foreground">Check back later or post your own.</p>
              <Link href="/jobs/post"><Button className="mt-5 rounded-xl"><Briefcase className="w-4 h-4 mr-2" />Post Opportunity</Button></Link>
            </div>
          )}
        </div>

        <AvailableCreatorsBoard />
      </div>
    </AppLayout>
  );
}
