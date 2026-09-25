import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { getInitials } from '@/lib/utils';
import {
  Search, Award, Clock, DollarSign, Briefcase, Star, Globe, Zap, ChevronRight, Users2, Filter
} from 'lucide-react';

interface SkillBadge { skill: string; endorsements: number }
interface Listing {
  id: number;
  title: string;
  category: string;
  pricingModel: string;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  skills: string;
}
interface Creator {
  user: { id: number; username: string; displayName: string; avatarUrl: string | null; bio: string | null };
  availability: {
    status: string;
    availableFor: string[];
    hoursPerWeek: number | null;
    ratePerHour: number | null;
    currency: string;
    timezone: string | null;
    publicNote: string | null;
    updatedAt: string;
  };
  skills: SkillBadge[];
  totalEndorsements: number;
  listings: Listing[];
  affinityScore: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  open_to_opportunities: 'bg-blue-500/15 text-blue-600 border-blue-200 dark:border-blue-800',
};
const STATUS_LABELS: Record<string, string> = {
  available: 'Available for others to find',
  open_to_opportunities: 'Collaboration Ready',
};

function CreatorCard({ creator }: { creator: Creator }) {
  const t = useT();
  const { user, availability, skills, totalEndorsements, listings, affinityScore } = creator;
  const topSkills = skills.slice(0, 4);
  const listing = listings[0] ?? null;

  const formatRate = () => {
    if (!availability.ratePerHour) return null;
    return `${availability.currency} ${availability.ratePerHour}/hr`;
  };

  const formatPrice = (l: Listing) => {
    if (!l.priceFrom) return l.pricingModel === 'negotiable' ? 'Negotiable' : null;
    const lo = `${l.currency} ${l.priceFrom.toLocaleString()}`;
    return l.priceTo ? `${lo}–${l.priceTo.toLocaleString()}` : `from ${lo}`;
  };

  return (
    <div data-card className="group rounded-2xl border border-border bg-card hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-5 flex items-start gap-4">
        <Link href={`/profile/${user.username}`}>
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {getInitials(user.displayName || user.username || '?')}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${user.username}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate">
              {user.displayName || user.username}
            </Link>
            {affinityScore > 0.1 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                <Zap className="w-2.5 h-2.5" /> Match
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">@{user.username}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[availability.status] ?? STATUS_COLORS.available}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
              {STATUS_LABELS[availability.status] ?? availability.status}
            </span>

            {availability.hoursPerWeek && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />{availability.hoursPerWeek}h/wk
              </span>
            )}

            {formatRate() && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <DollarSign className="w-3 h-3" />{formatRate()}
              </span>
            )}

            {availability.timezone && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Globe className="w-3 h-3" />{availability.timezone}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 hidden sm:block">
          <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
            <Award className="w-4 h-4" />{totalEndorsements}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">endorsements</p>
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <div className="px-4 md:px-5 pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{user.bio}</p>
        </div>
      )}

      {/* Public note */}
      {availability.publicNote && (
        <div className="mx-4 md:mx-5 mb-3 p-3 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs text-foreground/80 italic">"{availability.publicNote}"</p>
        </div>
      )}

      {/* Available for */}
      {availability.availableFor.length > 0 && (
        <div className="px-4 md:px-5 pb-3 flex flex-wrap gap-1.5">
          {availability.availableFor.slice(0, 4).map((item) => (
            <span key={item} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Top skills with endorsement counts */}
      {topSkills.length > 0 && (
        <div className="px-4 md:px-5 pb-3 flex flex-wrap gap-1.5">
          {topSkills.map(({ skill, endorsements }) => (
            <span key={skill} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20 font-medium">
              {skill}
              {endorsements > 0 && (
                <span className="bg-primary/15 rounded-full px-1 text-[9px] font-bold">{endorsements}</span>
              )}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[11px] text-muted-foreground px-2 py-0.5">+{skills.length - 4} more</span>
          )}
        </div>
      )}

      {/* Featured listing */}
      {listing && (
        <div className="mx-4 md:mx-5 mb-4 p-3 rounded-xl border border-border bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{listing.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{listing.category}</p>
            </div>
            {formatPrice(listing) && (
              <span className="text-[11px] font-semibold text-foreground shrink-0 whitespace-nowrap">{formatPrice(listing)}</span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto px-4 md:px-5 pb-4 md:pb-5 flex gap-2">
        <Link href={`/profile/${user.username}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
            View Profile <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
        <Link href={`/profile/${user.username}?action=collaborate`}>
          <Button size="sm" className="gap-1 text-xs">
            <Briefcase className="w-3 h-3" /> Request collaboration
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CreatorCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export default function Opportunities() {
  const t = useT();
  const { toast } = useToast();
  const token = getStoredToken();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 18;

  const [skillFilter, setSkillFilter] = useState('');
  const [availableForFilter, setAvailableForFilter] = useState('all');
  const [maxRate, setMaxRate] = useState<number>(500);
  const [showRateFilter, setShowRateFilter] = useState(false);
  const [minEndorsements, setMinEndorsements] = useState(0);

  const fetchCreators = useCallback(async (reset = false) => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(reset ? 0 : offset),
      minEndorsements: String(minEndorsements),
    });
    if (skillFilter.trim()) params.set('skill', skillFilter.trim());
    if (availableForFilter !== 'all') params.set('availableFor', availableForFilter);
    if (showRateFilter) params.set('maxRate', String(maxRate));

    try {
      const res = await fetch(`/api/opportunities?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (reset) {
        setCreators(Array.isArray(data.creators) ? data.creators : []);
        setOffset(LIMIT);
      } else {
        setCreators(prev => [...prev, ...(Array.isArray(data.creators) ? data.creators : [])]);
        setOffset(prev => prev + LIMIT);
      }
      setTotal(data.total ?? 0);
    } catch {
      toast({ title: t('common.failed', 'Failed to load opportunities'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [skillFilter, availableForFilter, maxRate, showRateFilter, minEndorsements, offset, token]);

  // Refetch on filter change (reset)
  useEffect(() => {
    setOffset(0);
    fetchCreators(true);
  }, [skillFilter, availableForFilter, maxRate, showRateFilter, minEndorsements]);

  const hasMore = creators.length < total;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
              <Users2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-tight">
              {t('opportunities.title', 'Browse People')}
            </h1>
          </div>
          <p className="text-muted-foreground ml-10 mb-5">
            {t('opportunities.subtitle', 'Verified creators - ranked by peer endorsements, creator level, and work portfolio.')}
          </p>

          {/* Employer / Creator dual-entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 to-purple-500/5 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Find a Creator</p>
                <p className="text-xs text-muted-foreground mt-0.5">Filter by skill, endorsements, rate, and availability to find the right fit for your project.</p>
              </div>
            </div>
            <Link
              href="/jobs/post"
              className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-4 flex items-start gap-3 hover:border-emerald-500/40 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Post Opportunity</p>
                <p className="text-xs text-muted-foreground mt-0.5">Reach verified creators actively looking for work, collaborations, or brand partnerships.</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Skill search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('opportunities.filterSkill', 'Filter by skill…')}
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Available for */}
          <Select value={availableForFilter} onValueChange={setAvailableForFilter}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Available for…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="ghostwriting">Ghostwriting</SelectItem>
              <SelectItem value="editing">Editing</SelectItem>
              <SelectItem value="content strategy">Content strategy</SelectItem>
              <SelectItem value="newsletters">Newsletters</SelectItem>
              <SelectItem value="copywriting">Copywriting</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="consulting">Consulting</SelectItem>
              <SelectItem value="mentoring">Mentoring</SelectItem>
            </SelectContent>
          </Select>

          {/* Min endorsements */}
          <Select value={String(minEndorsements)} onValueChange={v => setMinEndorsements(Number(v))}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Endorsements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any endorsements</SelectItem>
              <SelectItem value="1">1+ endorsements</SelectItem>
              <SelectItem value="5">5+ endorsements</SelectItem>
              <SelectItem value="10">10+ endorsements</SelectItem>
              <SelectItem value="25">25+ endorsements</SelectItem>
            </SelectContent>
          </Select>

          {/* Rate filter toggle */}
          <Button
            variant={showRateFilter ? 'default' : 'outline'}
            size="sm"
            className="h-9 gap-2"
            onClick={() => setShowRateFilter(v => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            {showRateFilter ? `≤ ${maxRate}/hr` : 'Rate filter'}
          </Button>
        </div>

        {/* Rate filter (conditional) */}
        {showRateFilter && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30 flex items-center gap-4 max-w-xs">
            <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground whitespace-nowrap">Max rate ($/hr):</p>
              <Input
                type="number"
                min={0}
                max={10000}
                step={10}
                value={maxRate}
                onChange={e => setMaxRate(Number(e.target.value))}
                className="h-8 w-24 text-sm"
              />
            </div>
          </div>
        )}

        {/* Stats bar */}
        {!loading && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Users2 className="w-4 h-4" />
            <span>
              {total === 0
                ? t('opportunities.noResults', 'No creators found matching your filters')
                : t('opportunities.results', `Showing ${creators.length} of ${total} creators`)}
            </span>
            {token && (
              <span className="ml-auto flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-medium">
                <Zap className="w-3 h-3" /> Affinity-boosted for you
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && creators.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <CreatorCardSkeleton key={i} />)
            : creators.map(c => <CreatorCard key={c.user.id} creator={c} />)
          }
        </div>

        {/* Empty state */}
        {!loading && creators.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{t('opportunities.emptyTitle', 'No creators available yet')}</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              {t('opportunities.emptyDesc', 'Try loosening your filters, or check back soon - creators update their availability regularly.')}
            </p>
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" onClick={() => fetchCreators(false)} className="gap-2">
              {t('common.loadMore', 'Load more')} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {loading && creators.length > 0 && (
          <div className="mt-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
