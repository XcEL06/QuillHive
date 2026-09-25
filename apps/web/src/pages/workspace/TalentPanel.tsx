import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { getStoredToken } from '@/lib/api';
import { useFeatureFlags } from '@/lib/features';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import {
  Search, Award, Clock, DollarSign, Briefcase, Globe, Zap, ChevronRight, Users2, CreditCard,
} from 'lucide-react';

interface SkillBadge { skill: string; endorsements: number }
interface Listing {
  id: number; title: string; category: string; pricingModel: string;
  priceFrom: number | null; priceTo: number | null; currency: string; skills: string;
}
interface Creator {
  user: { id: number; username: string; displayName: string; avatarUrl: string | null; bio: string | null };
  availability: {
    status: string; availableFor: string[]; hoursPerWeek: number | null;
    ratePerHour: number | null; currency: string; timezone: string | null;
    publicNote: string | null; updatedAt: string;
  };
  skills: SkillBadge[]; totalEndorsements: number; listings: Listing[]; affinityScore: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  open_to_opportunities: 'bg-blue-500/15 text-blue-600 border-blue-200 dark:border-blue-800',
};
const STATUS_LABELS: Record<string, string> = {
  available: 'Open to work',
  open_to_opportunities: 'Collaboration Ready',
};

function CreatorCard({ creator, checkoutEnabled, onCheckout }: { creator: Creator; checkoutEnabled: boolean; onCheckout: (listing: Listing) => void }) {
  const { user, availability, skills, totalEndorsements, listings, affinityScore } = creator;
  const topSkills = skills.slice(0, 3);
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
    <div data-card className="group rounded-2xl border border-border bg-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col overflow-hidden">
      <div className="p-4 md:p-5 flex items-start gap-3">
        <Link href={`/profile/${user.username}`}>
          <Avatar className="h-12 w-12 shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials(user.displayName || user.username || '?')}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${user.username}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate">
              {user.displayName || user.username}
            </Link>
            {affinityScore > 0.1 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                <Zap className="w-2 h-2" /> Match
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">@{user.username}</p>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[availability.status] ?? STATUS_COLORS.available}`}>
              <span className="w-1 h-1 rounded-full bg-current inline-block" />
              {STATUS_LABELS[availability.status] ?? availability.status}
            </span>
            {availability.hoursPerWeek && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />{availability.hoursPerWeek}h/wk
              </span>
            )}
            {formatRate() && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <DollarSign className="w-3 h-3" />{formatRate()}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 hidden sm:block">
          <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
            <Award className="w-3.5 h-3.5" />{totalEndorsements}
          </div>
          <p className="text-[10px] text-muted-foreground">endorsements</p>
        </div>
      </div>

      {user.bio && (
        <div className="px-4 md:px-5 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">{user.bio}</p>
        </div>
      )}

      {topSkills.length > 0 && (
        <div className="px-4 md:px-5 pb-3 flex flex-wrap gap-1">
          {topSkills.map(({ skill, endorsements }) => (
            <span key={skill} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20 font-medium">
              {skill}
              {endorsements > 0 && <span className="bg-primary/15 rounded-full px-1 text-[8px] font-bold">{endorsements}</span>}
            </span>
          ))}
          {skills.length > 3 && <span className="text-[10px] text-muted-foreground py-0.5">+{skills.length - 3} more</span>}
        </div>
      )}

      {listing && (
        <div className="mx-4 md:mx-5 mb-3 p-3 rounded-xl border border-border bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground truncate">{listing.title}</p>
            {formatPrice(listing) && <span className="text-[10px] font-semibold text-foreground shrink-0 whitespace-nowrap">{formatPrice(listing)}</span>}
          </div>
        </div>
      )}

      <div className="mt-auto px-4 md:px-5 pb-4 md:pb-5 flex gap-2">
        <Link href={`/profile/${user.username}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1 text-xs h-8">
            View Profile <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
        {checkoutEnabled && listing?.pricingModel === 'fixed' && listing.priceFrom ? (
          <Button size="sm" className="gap-1 text-xs h-8" onClick={() => onCheckout(listing)}>
            <CreditCard className="w-3 h-3" /> Pay
          </Button>
        ) : (
          <Link href={`/profile/${user.username}?action=collaborate`}>
            <Button size="sm" className="gap-1 text-xs h-8">
              <Briefcase className="w-3 h-3" /> Request collaboration
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function CreatorCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-28 mb-1.5" />
          <Skeleton className="h-3 w-20 mb-1.5" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-1"><Skeleton className="h-4 w-14 rounded-full" /><Skeleton className="h-4 w-16 rounded-full" /></div>
      <div className="flex gap-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 w-16 rounded-lg" /></div>
    </div>
  );
}

export function TalentPanel() {
  const { toast } = useToast();
  const token = getStoredToken();
  const featureFlags = useFeatureFlags();
  const checkoutEnabled = featureFlags.service_checkout_enabled === true;

  const [creators, setCreators] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 12;

  const [skillFilter, setSkillFilter] = useState('');
  const [availableForFilter, setAvailableForFilter] = useState('all');
  const [checkoutListingId, setCheckoutListingId] = useState<number | null>(null);

  const handleCheckout = async (listing: Listing) => {
    setCheckoutListingId(listing.id);
    try {
      const res = await fetch('/api/payments/service/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ serviceListingId: listing.id, redirectUrl: `${window.location.origin}/payments/complete` }),
      });
      const data = await res.json() as { link?: string; error?: string };
      if (!res.ok || !data.link) throw new Error(data.error ?? 'Could not start checkout');
      window.location.assign(data.link);
    } catch (error) {
      toast({ title: 'Checkout unavailable', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      setCheckoutListingId(null);
    }
  };

  const fetchCreators = useCallback(async (reset = false) => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(reset ? 0 : offset),
    });
    if (skillFilter.trim()) params.set('skill', skillFilter.trim());
    if (availableForFilter !== 'all') params.set('availableFor', availableForFilter);

    try {
      const res = await fetch(`/api/opportunities?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (reset) {
        setCreators(Array.isArray(data?.creators) ? data.creators : []);
        setOffset(LIMIT);
      } else {
        setCreators(prev => [...prev, ...(Array.isArray(data?.creators) ? data.creators : [])]);
        setOffset(prev => prev + LIMIT);
      }
      setTotal(data.total ?? 0);
    } catch {
      toast({ title: 'Failed to load talent', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [skillFilter, availableForFilter, offset, token]);

  useEffect(() => {
    setOffset(0);
    fetchCreators(true);
  }, [skillFilter, availableForFilter]);

  const hasMore = creators.length < total;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by skill…"
            value={skillFilter}
            onChange={e => setSkillFilter(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={availableForFilter} onValueChange={setAvailableForFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Available for…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="freelance">Freelance</SelectItem>
            <SelectItem value="commission">Commission</SelectItem>
            <SelectItem value="collaboration">Collaboration</SelectItem>
            <SelectItem value="full-time">Full-time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground">{total.toLocaleString()} people available</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {loading && creators.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <CreatorCardSkeleton key={i} />)
          : creators.map(c => <CreatorCard key={c.user.id} creator={c} checkoutEnabled={checkoutEnabled && checkoutListingId === null} onCheckout={handleCheckout} />)
        }
      </div>

      {!loading && creators.length === 0 && (
        <div className="text-center py-12">
          <Users2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No creators found matching your filters.</p>
        </div>
      )}

      {hasMore && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchCreators(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
