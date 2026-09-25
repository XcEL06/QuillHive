import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Rocket, Star, Zap, Briefcase, Check, ArrowRight, TrendingUp, Eye, Users, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useGetUserPosts, getGetUserPostsQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { getStoredToken } from '@/lib/api';
import { contactEmail } from '@/lib/contact';

type BoostPlan = 'starter' | 'growth' | 'spotlight';

interface VisibilityPlan {
  key: BoostPlan;
  icon: typeof Zap;
  name: string;
  label: string;
  duration: string;
  emoji: string;
  color: string;
  featured?: boolean;
  perks: string[];
  description: string;
}

const VISIBILITY_PLANS: VisibilityPlan[] = [
  {
    key: 'starter',
    icon: Zap,
    name: 'Starter Boost',
    label: 'Good for testing reach',
    duration: '2 days',
    emoji: '⚡',
    color: 'from-orange-500 to-amber-500',
    description: 'Give your post an initial push to reach more people beyond your current followers.',
    perks: [
      'Elevated feed ranking for 2 days',
      'Shown to non-followers',
      'Priority in Explore feed',
    ],
  },
  {
    key: 'growth',
    icon: Rocket,
    name: 'Growth Boost',
    label: 'Accelerate your growth',
    duration: '7 days',
    emoji: '🚀',
    color: 'from-violet-500 to-purple-500',
    featured: true,
    description: 'Sustained exposure across Discover and Trending sections to build real momentum.',
    perks: [
      'Everything in Starter',
      'Featured in Discover section',
      '7-day elevated visibility',
      'Creator profile highlight',
    ],
  },
  {
    key: 'spotlight',
    icon: Star,
    name: 'Spotlight',
    label: 'Maximum visibility',
    duration: '15 days',
    emoji: '🌟',
    color: 'from-rose-500 to-pink-500',
    description: 'Top placement across QuillHive with newsletter and social amplification for maximum impact.',
    perks: [
      'Everything in Growth',
      'Homepage featured slot',
      'Weekly newsletter mention',
      'Social media amplification',
      'Instant activation after payment',
    ],
  },
];

interface UserPost {
  id: number;
  title?: string | null;
}

function PricingBadge({ featured }: { featured?: boolean }) {
  if (!featured) return null;
  return (
    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 px-4 py-1 text-xs font-semibold shadow-lg">
      Most Popular
    </Badge>
  );
}

function BoostRequestDialog({
  open,
  onOpenChange,
  initialPlan,
  initialPostId,
  posts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan: BoostPlan;
  initialPostId?: number | null;
  posts: UserPost[];
}) {
  const { toast } = useToast();
  const token = getStoredToken();
  const [selectedPostId, setSelectedPostId] = useState<string>(initialPostId ? String(initialPostId) : '');
  const [selectedPlan, setSelectedPlan] = useState<BoostPlan>(initialPlan);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlan(initialPlan);
      setSelectedPostId(initialPostId ? String(initialPostId) : '');
      setMessage('');
    }
  }, [open, initialPlan, initialPostId]);

  const handleSubmit = async () => {
    if (!selectedPostId) {
      toast({ title: 'Select a post to boost', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/boost/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ postId: Number(selectedPostId), plan: selectedPlan }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? 'Request failed', variant: 'destructive' });
        return;
      }
      toast({
        title: '🚀 Boost request submitted!',
        description: 'Your boost will activate as soon as payment is verified.',
      });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to submit boost request', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const planInfo = VISIBILITY_PLANS.find(p => p.key === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-violet-500" /> Request a Boost
          </DialogTitle>
          <DialogDescription>
            Select a post and boost type. Once payment is verified, your boost activates instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Post selector */}
          <div className="space-y-1.5">
            <Label>Which post do you want to boost?</Label>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                You haven't published any posts yet.{' '}
                <Link href="/write" className="text-primary hover:underline">Write one →</Link>
              </p>
            ) : (
              <Select value={selectedPostId} onValueChange={setSelectedPostId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a post…" />
                </SelectTrigger>
                <SelectContent>
                  {posts.map(post => (
                    <SelectItem key={post.id} value={String(post.id)}>
                      {post.title ?? `Post #${post.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Plan selector */}
          <div className="space-y-1.5">
            <Label>Boost type</Label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_PLANS.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    selectedPlan === plan.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <div className="text-lg mb-1">{plan.emoji}</div>
                  <div className="text-xs font-semibold">{plan.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-muted-foreground">{plan.duration}</div>
                </button>
              ))}
            </div>
            {planInfo && (
              <p className="text-xs text-muted-foreground pt-1">{planInfo.description}</p>
            )}
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Label>
              Message to our team{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us about your post or your growth goals…"
              className="rounded-xl resize-none text-sm"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedPostId}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Pricing() {
  const { user } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BoostPlan>('growth');
  const [preselectedPostId, setPreselectedPostId] = useState<number | null>(null);
  const [requestForm, setRequestForm] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const { data: postsData } = useGetUserPosts(user?.username ?? '', { limit: 50 }, {
    query: { enabled: !!user?.username, queryKey: getGetUserPostsQueryKey(user?.username ?? '', { limit: 50 }) },
  });

  const posts = (postsData as { posts?: UserPost[] } | undefined)?.posts;
  const userPosts: UserPost[] = (Array.isArray(posts) ? posts : []).filter(
    (p: UserPost) => !!p.title,
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const postId = params.get('postId');
      const plan = params.get('plan') as BoostPlan | null;
      if (postId) setPreselectedPostId(Number(postId));
      if (plan && ['starter', 'growth', 'spotlight'].includes(plan)) setSelectedPlan(plan);
      if (postId) setDialogOpen(true);
    }
  }, []);

  const openDialog = (plan: BoostPlan) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        {/* Hero */}
        <div className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Visibility Engine
          </Badge>
          <h1 className="text-4xl font-serif font-bold mb-4">
            Grow faster on QuillHive
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Boost your content, reach more people, and unlock opportunities.
            Pay once and your campaign goes live immediately after verification.
          </p>
        </div>

        {/* Boost Tiers */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-bold mb-2">Post Visibility Boosts</h2>
          <p className="text-muted-foreground mb-8">
            Choose a boost for your best work and watch it reach the right audience.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {VISIBILITY_PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.key}
                  className={`relative overflow-visible ${plan.featured ? 'border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10' : 'border-border/60'}`}
                >
                  <PricingBadge featured={plan.featured} />
                  <CardHeader className="pb-3 pt-6">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-3 text-white shadow-lg`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.duration} visibility</p>
                    <Badge variant="outline" className="mt-1 w-fit text-[10px] text-muted-foreground border-border/50">
                      {plan.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <ul className="space-y-2">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                    {user ? (
                      <Button
                        className={`w-full rounded-xl ${plan.featured ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 shadow-lg' : ''}`}
                        variant={plan.featured ? 'default' : 'outline'}
                        onClick={() => openDialog(plan.key)}
                      >
                        <Rocket className="w-4 h-4 mr-2" /> Request {plan.name}
                      </Button>
                    ) : (
                      <Button className="w-full rounded-xl" variant="outline" asChild>
                        <Link href="/auth">
                          <ArrowRight className="w-4 h-4 mr-2" /> Sign in to boost
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How boosting works */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-bold mb-2">How boosting works</h2>
          <p className="text-muted-foreground mb-8">
            Boosting is straightforward: choose a plan, pay, and your campaign starts without a manual approval gate.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {([
              { icon: Rocket, color: 'text-violet-500 bg-violet-500/10', title: 'You request', desc: 'Pick a post and a boost type. Add an optional note for our team.' },
              { icon: Eye, color: 'text-blue-500 bg-blue-500/10', title: 'Verification', desc: 'Secure payment verification confirms your campaign and starts the boost immediately.' },
              { icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10', title: 'Boost activates', desc: 'Your post gets elevated placement in Discover, Trending, and Featured sections.' },
              { icon: Users, color: 'text-orange-500 bg-orange-500/10', title: 'You grow', desc: 'More eyes on your work means more followers, feedback, and opportunities.' },
            ] as const).map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border/50 bg-muted/30 p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Where boosted posts appear
            </h3>
            <ul className="grid sm:grid-cols-3 gap-2">
              {['Discover feed', 'Trending section', 'Featured placements', 'Creator Explore', 'Topic pages', 'Weekly digest'].map(place => (
                <li key={place} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {place}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Creator Spotlight */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-bold mb-2">Creator Spotlight</h2>
          <p className="text-muted-foreground mb-8">
            Amplify your entire profile - great for creators launching a new project or growing their audience.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: 'Profile Boost',
                duration: '7 days',
                featured: false,
                perks: ['Featured in Suggested Creators', 'Boosted in search results', 'Follower growth amplification'],
              },
              {
                name: 'Creator Feature',
                duration: '30 days',
                featured: true,
                perks: ['Profile boost included', 'Homepage creator spotlight', 'Interview in QuillHive newsletter', 'Social media shoutout'],
              },
            ].map((plan) => (
              <Card key={plan.name} className={`relative overflow-visible ${plan.featured ? 'border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10' : 'border-border/60'}`}>
                <PricingBadge featured={plan.featured} />
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.duration}</p>
                  </div>
                  <ul className="space-y-2">
                    {plan.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{p}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full rounded-xl" variant="outline" asChild>
                    <a href={`mailto:${contactEmail()}?subject=Creator Spotlight Request`}>
                      <ArrowRight className="w-4 h-4 mr-2" /> Request Slot
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Job Listings */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-bold mb-2">Job Listings</h2>
          <p className="text-muted-foreground mb-8">
            Reach skilled creators. Post an opportunity and connect with the right person.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: 'Standard Listing',
                duration: '30 days',
                featured: false,
                perks: ['Job visible to all creators', 'Searchable by skills & location', 'Application management'],
              },
              {
                name: 'Featured Listing',
                duration: '30 days',
                featured: true,
                perks: ['Everything in Standard', 'Pinned to top of jobs feed', 'Badge for high visibility', 'Email digest inclusion'],
              },
            ].map((plan) => (
              <Card key={plan.name} className={`relative overflow-visible ${plan.featured ? 'border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10' : 'border-border/60'}`}>
                <PricingBadge featured={plan.featured} />
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-primary" /> {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{plan.duration}</p>
                  </div>
                  <ul className="space-y-2">
                    {plan.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{p}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full rounded-xl" variant={plan.featured ? 'default' : 'outline'} asChild>
                    <Link href="/jobs">
                      <ArrowRight className="w-4 h-4 mr-2" /> Post Opportunity
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ / Note */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-8 text-center mb-12">
          <h3 className="text-xl font-serif font-bold mb-3">How does requesting work?</h3>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Click "Request" on any plan, complete payment, and your boost activates as soon as verification succeeds.
            The admin review tools remain available for moderation, but they are not a blocker to campaign activation.
          </p>
          <a
            href={`mailto:${contactEmail()}?subject=Pricing Enquiry`}
            className="text-primary hover:underline text-sm font-medium"
          >
            Questions? Email us →
          </a>
        </div>

        {/* Contact / General Enquiry Form */}
        <section className="mb-8">
          <h2 className="text-2xl font-serif font-bold mb-2">Get in touch</h2>
          <p className="text-muted-foreground mb-8">
            Have a custom requirement or want to learn more? Send us a message and we'll get back to you within one business day.
          </p>
          {submitted ? (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
              <div className="text-3xl mb-3">✅</div>
              <h3 className="text-lg font-semibold mb-1">Message received!</h3>
              <p className="text-sm text-muted-foreground">We'll be in touch within one business day.</p>
              <button onClick={() => { setSubmitted(false); setRequestForm({ name: '', email: '', message: '' }); }} className="mt-4 text-sm text-primary hover:underline">Send another message</button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card p-6 max-w-xl space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Your name</Label>
                  <input
                    id="contact-name"
                    value={requestForm.name}
                    onChange={e => setRequestForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    maxLength={100}
                    className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">Email address</Label>
                  <input
                    id="contact-email"
                    type="email"
                    value={requestForm.email}
                    onChange={e => setRequestForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                    maxLength={200}
                    className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  value={requestForm.message}
                  onChange={e => setRequestForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us what you're looking for…"
                  className="rounded-xl resize-none text-sm"
                  rows={4}
                  maxLength={2000}
                />
              </div>
              <Button
                onClick={async () => {
                  if (!requestForm.name.trim() || !requestForm.email.trim() || !requestForm.message.trim()) {
                    toast({ title: 'Please fill in all fields', variant: 'destructive' }); return;
                  }
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/support/contact', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: requestForm.name, email: requestForm.email, message: requestForm.message, category: 'boost_request' }),
                    });
                    if (!res.ok) throw new Error('Failed');
                    setSubmitted(true);
                  } catch {
                    toast({ title: 'Could not send message. Please try emailing us directly.', variant: 'destructive' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="rounded-xl w-full sm:w-auto"
              >
                {submitting ? 'Sending…' : 'Send message'}
              </Button>
            </div>
          )}
        </section>

      </div>

      {/* Boost Request Dialog */}
      <BoostRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPlan={selectedPlan}
        initialPostId={preselectedPostId}
        posts={userPosts}
      />
    </PublicLayout>
  );
}
