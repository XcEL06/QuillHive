import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import {
  Search, Award, Clock, DollarSign, Briefcase, Star, ShieldCheck,
  Zap, ChevronRight, Users2, Filter, Film, Handshake, Globe, Loader2
} from 'lucide-react';

interface SkillBadge { skill: string; endorsements: number }
interface Listing {
  id: number; title: string; pricingModel: string;
  priceFrom: number | null; priceTo: number | null; currency: string;
}
interface Creator {
  user: { id: number; username: string; displayName: string; avatarUrl: string | null; bio: string | null };
  availability: {
    status: string; availableFor: string[];
    hoursPerWeek: number | null; ratePerHour: number | null;
    currency: string; timezone: string | null; publicNote: string | null;
  };
  skills: SkillBadge[];
  totalEndorsements: number;
  listings: Listing[];
  affinityScore: number;
  motionUrl?: string | null;
  trustTier?: string;
  creatorLevel?: string;
}

const STATUS_COLORS: Record<string, string> = {
  available:              'bg-emerald-500/15 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  open_to_opportunities:  'bg-blue-500/15 text-blue-600 border-blue-200 dark:border-blue-800',
};
const STATUS_LABELS: Record<string, string> = {
  available:             'Available for others to find',
  open_to_opportunities: 'Collaboration Ready',
};
const TIER_COLORS: Record<string, string> = {
  trusted:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  normal:   'bg-primary/10 text-primary border-primary/20',
  limited:  'bg-amber-500/10 text-amber-600 border-amber-500/20',
};
const LEVEL_LABELS: Record<string, string> = {
  luminary: 'Luminary', featured: 'Featured', established: 'Certified Operator',
  rising: 'Proven Writer', new_voice: 'Aspiring',
};

function CollabRequestModal({ creator, open, onClose }: { creator: Creator | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const token = getStoredToken();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!creator) return null;

  const send = async () => {
    if (!token) { toast({ title: 'Sign in first', variant: 'destructive' }); return; }
    if (!message.trim()) { toast({ title: 'Add a message', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const res = await fetch('/api/collaboration/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: creator.user.id, message: message.trim() }),
      });
      if (!res.ok) throw new Error('Failed to send');
      toast({ title: 'Collaboration request sent! 🤝' });
      setMessage('');
      onClose();
    } catch {
      toast({ title: 'Failed to send request', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              {creator.user.avatarUrl && <img src={creator.user.avatarUrl} alt="" />}
              <AvatarFallback className="text-xs">{getInitials(creator.user.displayName)}</AvatarFallback>
            </Avatar>
            Collaborate with {creator.user.displayName}
          </DialogTitle>
          <DialogDescription>Send a collaboration request with context about your project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {creator.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {creator.skills.slice(0, 5).map(s => (
                <Badge key={s.skill} variant="secondary" className="text-[10px] rounded-lg">
                  {s.skill} {s.endorsements > 0 && <span className="ml-1 opacity-60">×{s.endorsements}</span>}
                </Badge>
              ))}
            </div>
          )}
          <Textarea
            placeholder={`Hi ${creator.user.displayName}, I'd love to collaborate on…`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="rounded-xl min-h-[100px] text-sm"
            autoFocus
          />
          <Button onClick={send} disabled={sending} className="w-full h-11 rounded-xl gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send Collaborative Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TalentCard({ creator, onCollabClick }: { creator: Creator; onCollabClick: (c: Creator) => void }) {
  const topSkills = creator.skills.slice(0, 4);
  const listing   = creator.listings[0] ?? null;
  const status    = creator.availability.status;
  const tier      = creator.trustTier ?? 'normal';
  const level     = creator.creatorLevel ?? 'new_voice';

  const formatRate = () => {
    if (!creator.availability.ratePerHour) return null;
    return `${creator.availability.currency} ${creator.availability.ratePerHour}/hr`;
  };

  return (
    <div className="group rounded-2xl border border-border bg-card hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 flex flex-col overflow-hidden">
      {/* Motion preview */}
      {creator.motionUrl && (
        <div className="relative h-32 bg-muted overflow-hidden">
          <video
            src={creator.motionUrl}
            className="w-full h-full object-cover"
            muted
            loop
            onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <Badge className="absolute bottom-2 left-2 bg-black/60 text-white border-0 text-[9px] gap-1">
            <Film className="w-2.5 h-2.5" /> Motion Showcase
          </Badge>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/profile/${creator.user.username}`}>
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
              {creator.user.avatarUrl && <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{getInitials(creator.user.displayName)}</AvatarFallback>}
              {creator.user.avatarUrl ? <img src={creator.user.avatarUrl} alt={creator.user.displayName} className="h-full w-full object-cover rounded-full" /> : null}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{getInitials(creator.user.displayName)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${creator.user.username}`} className="font-bold text-sm hover:text-primary transition-colors truncate">
                {creator.user.displayName}
              </Link>
              {tier === 'trusted' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground">@{creator.user.username}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {status && STATUS_LABELS[status] && (
                <Badge className={`text-[9px] border shrink-0 px-1.5 py-0 ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[status]}
                </Badge>
              )}
              {LEVEL_LABELS[level] && (
                <Badge className={`text-[9px] border shrink-0 px-1.5 py-0 ${TIER_COLORS[tier] ?? TIER_COLORS['normal']}`}>
                  {LEVEL_LABELS[level]}
                </Badge>
              )}
              {creator.affinityScore > 0 && (
                <Badge className="text-[9px] border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 shrink-0 px-1.5 py-0 gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> Match
                </Badge>
              )}
            </div>
          </div>
        </div>

        {creator.user.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2">{creator.user.bio}</p>
        )}

        {/* Skills */}
        {topSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topSkills.map(s => (
              <div key={s.skill} className="flex items-center gap-1 text-[10px] bg-secondary rounded-full px-2 py-0.5">
                <span className="font-medium">{s.skill}</span>
                {s.endorsements > 0 && <span className="text-muted-foreground">×{s.endorsements}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Rate + service */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
          {formatRate() && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="w-3 h-3" />{formatRate()}
            </span>
          )}
          {creator.availability.timezone && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{creator.availability.timezone}</span>
          )}
          {creator.totalEndorsements > 0 && (
            <span className="flex items-center gap-1"><Award className="w-3 h-3" />{creator.totalEndorsements} endorsements</span>
          )}
        </div>

        {/* Featured service */}
        {listing && (
          <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
            <span className="font-medium truncate mr-2">{listing.title}</span>
            {listing.priceFrom && (
              <span className="shrink-0 text-muted-foreground">from {listing.currency} {listing.priceFrom.toLocaleString()}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9 rounded-xl text-xs gap-1 min-h-[44px]"
            onClick={() => onCollabClick(creator)}
          >
            <Handshake className="w-3.5 h-3.5" /> Collaborate
          </Button>
          <Link href={`/profile/${creator.user.username}`}>
            <Button size="sm" className="h-9 rounded-xl text-xs gap-1 min-h-[44px] px-3">
              View <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TalentScout() {
  const [creators, setCreators]           = useState<Creator[]>([]);
  const [total, setTotal]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [offset, setOffset]               = useState(0);
  const [skillFilter, setSkillFilter]     = useState('');
  const [tierFilter, setTierFilter]       = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [minEndorsements, setMinEndorse]  = useState(0);
  const [collab, setCollab]               = useState<Creator | null>(null);
  const token = getStoredToken();
  const LIMIT = 12;

  const fetchCreators = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(reset ? 0 : offset),
        ...(skillFilter && { skill: skillFilter }),
        ...(tierFilter !== 'all' && { tier: tierFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(minEndorsements > 0 && { minEndorsements: String(minEndorsements) }),
      });
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res  = await fetch(`/api/opportunities?${params}`, { headers });
      const data: { creators?: Creator[]; total?: number } = res.ok ? await res.json() : {};
      const list: Creator[] = Array.isArray(data?.creators) ? data.creators : [];
      setCreators(prev => reset ? list : [...prev, ...list]);
      setTotal(data.total ?? 0);
      if (reset) setOffset(0);
    } finally {
      setLoading(false);
    }
  }, [skillFilter, tierFilter, statusFilter, minEndorsements, offset, token]);

  useEffect(() => { setOffset(0); fetchCreators(true); }, [skillFilter, tierFilter, statusFilter, minEndorsements]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center">
              <Users2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-tight">Talent Scout Pool</h1>
          </div>
          <p className="text-muted-foreground ml-10 text-sm">
            Search verified creators by skills, attestation tier, and opportunity readiness. Hover Motion cards to preview their showcase reel.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filter by skill…"
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)}
              className="pl-9 h-9 text-sm rounded-xl"
            />
          </div>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-9 w-[180px] text-sm rounded-xl">
              <ShieldCheck className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Attestation tier…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="trusted">Trusted</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[200px] text-sm rounded-xl">
              <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Availability status…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available for others to find</SelectItem>
              <SelectItem value="open_to_opportunities">Collaboration Ready</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(minEndorsements)} onValueChange={v => setMinEndorse(Number(v))}>
            <SelectTrigger className="h-9 w-[160px] text-sm rounded-xl">
              <Award className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any endorsements</SelectItem>
              <SelectItem value="1">1+ endorsements</SelectItem>
              <SelectItem value="5">5+ endorsements</SelectItem>
              <SelectItem value="10">10+ endorsed</SelectItem>
              <SelectItem value="25">25+ endorsed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-muted-foreground mb-5">
            {total > 0 ? `${total} creator${total !== 1 ? 's' : ''} found` : 'No creators match these filters'}
          </p>
        )}

        {/* Grid */}
        {loading && creators.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No creators match your filters.</p>
            <p className="text-sm mt-1">Try broadening the skill or tier filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {creators.map(c => (
              <TalentCard key={c.user.id} creator={c} onCollabClick={setCollab} />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && creators.length < total && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={() => { setOffset(creators.length); fetchCreators(); }}
              className="rounded-xl gap-2 min-h-[44px]"
            >
              Load more creators <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        {loading && creators.length > 0 && (
          <div className="flex justify-center mt-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <CollabRequestModal creator={collab} open={!!collab} onClose={() => setCollab(null)} />
    </AppLayout>
  );
}
