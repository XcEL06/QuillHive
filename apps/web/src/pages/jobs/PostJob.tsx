import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiUrl, getApiErrorMessage, getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { BackButton } from '@/components/ui/BackButton';
import {
  Briefcase, Calendar, DollarSign, Tag, FileCheck, Plus, X,
  Globe, MapPin, Mail, Link as LinkIcon, ChevronRight, Loader2, Sparkles
} from 'lucide-react';

function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const OPPORTUNITY_TYPES = [
  { value: 'freelance',          label: 'Freelance',          desc: 'Short or long-term project work' },
  { value: 'micro_contract',     label: 'Micro-Contract',     desc: 'Bounded deliverable, fixed scope' },
  { value: 'full_time',          label: 'Full-Time Role',     desc: 'Permanent or long-term position' },
  { value: 'collaboration',      label: 'Collaboration',      desc: 'Co-create without cash exchange' },
  { value: 'syndicate_funding',  label: 'Syndicate Funding',  desc: 'Revenue-share or equity arrangement' },
];

export default function PostJob() {
  const [locationPath, setLocation] = useLocation();
  const search = useSearch();
  const editId = new URLSearchParams(search).get("edit");
  const { toast } = useToast();
  const { user } = useAuthStore();
  const token = getStoredToken();

  const [title, setTitle]                   = useState('');
  const [type, setType]                     = useState('freelance');
  const [companyName, setCompanyName]       = useState('');
  const [description, setDescription]       = useState('');
  const [outputCriteria, setOutputCriteria] = useState('');
  const [rateType, setRateType]             = useState<'hourly' | 'fixed'>('hourly');
  const [budgetMin, setBudgetMin]           = useState('');
  const [budgetMax, setBudgetMax]           = useState('');
  const [currency, setCurrency]             = useState('USD');
  const [feeDiscussion, setFeeDiscussion]   = useState(false);
  const [feeDetails, setFeeDetails]         = useState('');
  const [expiresAt, setExpiresAt]           = useState(() => toLocalDateTimeValue(new Date(Date.now() + 30 * 24 * 60 * 60_000)));
  const [remote, setRemote]                 = useState(true);
  const [location, setLocation2]            = useState('');
  const [applyUrl, setApplyUrl]             = useState('');
  const [applyEmail, setApplyEmail]         = useState('');
  const [skillInput, setSkillInput]         = useState('');
  const [skills, setSkills]                 = useState<string[]>([]);
  const [isActive, setIsActive]             = useState(true);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [isLoadingEdit, setIsLoadingEdit]   = useState(Boolean(editId));

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setIsLoadingEdit(true);
    void (async () => {
      try {
        const res = await fetch(apiUrl(`/api/jobs/${editId}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(await getApiErrorMessage(res, "Could not load this opportunity."));
        const job: {
          id?: number; authorId?: number; author?: { id?: number };
          title?: string; type?: string; companyName?: string | null; description?: string;
          budget?: number | string | null; compensation?: string | null; remote?: boolean;
          location?: string | null; applyUrl?: string | null; applyEmail?: string | null; skills?: string[];
          isActive?: boolean; feeDetails?: string | null; expiresAt?: string | null;
        } = await res.json();
        if (cancelled) return;
        if (!user || Number(job.authorId ?? job.author?.id) !== Number(user.id)) {
          throw new Error('You can only edit your own opportunities.');
        }
        setTitle(job.title ?? '');
        setType(job.type ?? 'freelance');
        setCompanyName(job.companyName ?? '');
        setDescription(job.description ?? '');
        const savedFeeDetails = job.feeDetails ?? '';
        setFeeDiscussion(savedFeeDetails.startsWith('Fee is open to discussion.'));
        setFeeDetails(savedFeeDetails.replace(/^Fee is open to discussion\.\s*/i, ''));
        if (job.expiresAt) setExpiresAt(toLocalDateTimeValue(new Date(job.expiresAt)));
        setRemote(job.remote ?? true);
        setLocation2(job.location ?? '');
        setApplyUrl(job.applyUrl ?? '');
        setApplyEmail(job.applyEmail ?? '');
        setSkills(Array.isArray(job.skills) ? job.skills : []);
        setIsActive(job.isActive ?? true);
        const compensation = job.compensation?.match(/^([A-Z]{3})\s+([\d.]+)(?:[–-]([\d.]+))?(\/hr| fixed)$/);
        if (compensation) {
          setCurrency(compensation[1]);
          setBudgetMin(compensation[2]);
          setBudgetMax(compensation[3] ?? '');
          setRateType(compensation[4] === '/hr' ? 'hourly' : 'fixed');
        } else {
          setBudgetMin(job.budget == null ? '' : String(job.budget));
        }
      } catch (error) {
        if (!cancelled) {
          toast({ title: error instanceof Error ? error.message : 'Could not load this opportunity', variant: 'destructive' });
          setLocation('/workspace?tab=work');
        }
      } finally {
        if (!cancelled) setIsLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, token, user?.id, setLocation, toast]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast({ title: 'Sign in to post', variant: 'destructive' }); return; }
    if (!title.trim()) { toast({ title: 'Role title is required', variant: 'destructive' }); return; }
    if (!description.trim()) { toast({ title: 'Description is required', variant: 'destructive' }); return; }
    const expiryDate = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      toast({ title: 'Choose a future end date', description: 'This opportunity will close automatically at the selected date and time.', variant: 'destructive' });
      return;
    }

    const minVal = budgetMin ? parseFloat(budgetMin) : null;
    const maxVal = budgetMax ? parseFloat(budgetMax) : null;
    if ((budgetMin && (!Number.isFinite(minVal) || minVal! < 0)) ||
        (budgetMax && (!Number.isFinite(maxVal) || maxVal! < 0)) ||
      (maxVal !== null && minVal === null) ||
      (maxVal !== null && minVal !== null && maxVal < minVal)) {
      toast({ title: 'Check the budget', description: 'Enter valid non-negative amounts and make sure the maximum is not below the minimum.', variant: 'destructive' });
      return;
    }
    if (title.trim().length > 180 || description.trim().length > 50_000 || skills.length > 30 || skills.some(skill => skill.trim().length > 60)) {
      toast({ title: 'Check the opportunity details', description: 'Titles are limited to 180 characters, descriptions to 50,000, and skills to 30 entries of 60 characters each.', variant: 'destructive' });
      return;
    }

    const compensationStr = (() => {
      if (!minVal) return undefined;
      const suffix = rateType === 'hourly' ? '/hr' : ' fixed';
      const range  = maxVal && maxVal > minVal ? `${minVal}–${maxVal}` : `${minVal}`;
      return `${currency} ${range}${suffix}`;
    })();

    const fullDescription = outputCriteria.trim()
      ? `${description.trim()}\n\n**Proof Criterion:** ${outputCriteria.trim()}`
      : description.trim();
    if (fullDescription.length > 50_000) {
      toast({ title: 'Description is too long', description: 'The complete description, including proof criteria, must be under 50,000 characters.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const savedFeeDetails = feeDiscussion
        ? `Fee is open to discussion.${feeDetails.trim() ? ` ${feeDetails.trim()}` : ' Applicants are welcome to propose a rate and discuss scope, milestones, and payment timing.'}`
        : feeDetails.trim() || null;
      const res = await fetch(apiUrl(editId ? `/api/jobs/${editId}` : '/api/jobs'), {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title:        title.trim(),
          type,
          description:  fullDescription,
          skills,
          compensation: compensationStr ?? null,
          feeDetails: savedFeeDetails,
          expiresAt: expiryDate.toISOString(),
          budget:       minVal ?? null,
          companyName:  companyName.trim() || null,
          remote,
          location:     !remote && location.trim() ? location.trim() : null,
          applyUrl:     applyUrl.trim() || null,
          applyEmail:   applyEmail.trim() || null,
          isPaid:       !!minVal && minVal > 0,
          category:     type,
          isActive,
        }),
      });
      const data: { error?: string; id?: number; message?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Could not save this opportunity.'));
      toast({
        title: editId ? 'Opportunity updated.' : data.message ? 'Opportunity submitted for review' : 'Opportunity posted! 🎉',
        description: data.message ?? (editId ? undefined : 'Creators can now discover your opportunity.'),
      });
      setLocation(editId ? '/workspace?tab=work' : '/jobs');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post your opportunity.';
      setSubmitError(message);
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BackButton fallback="/workspace?tab=work" />
        <div className="mb-7 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 border-primary/20 bg-background/70 text-primary">Workspace · Opportunity</Badge>
              <h1 className="text-2xl font-bold tracking-tight font-serif sm:text-3xl">{editId ? 'Edit opportunity' : 'Post an opportunity'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Set clear expectations for the work, fee, and application deadline so the right people can respond.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section aria-labelledby="opportunity-basics-heading" className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <div className="border-b border-border/60 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">01 · The opportunity</p>
              <h2 id="opportunity-basics-heading" className="mt-1 text-lg font-semibold">What do you need?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Start with a specific title and the type of engagement.</p>
            </div>
          {/* Role Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-1.5 text-sm font-semibold">
              <Briefcase className="w-4 h-4" /> Role Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Technical Writer for DevTools Platform"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-11 rounded-xl text-base"
            />
          </div>

          {/* Opportunity Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Opportunity Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPPORTUNITY_TYPES.map(ot => (
                <button
                  key={ot.value}
                  type="button"
                  onClick={() => setType(ot.value)}
                  className={`text-left rounded-xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    type === ot.value
                      ? 'border-primary bg-primary/8 ring-1 ring-primary/20'
                      : 'border-border/60 bg-card hover:border-primary/40'
                  }`}
                >
                  <p className={`font-semibold text-sm ${type === ot.value ? 'text-primary' : ''}`}>{ot.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ot.desc}</p>
                </button>
              ))}
            </div>
          </div>
          </section>

          {/* Budget / Rate */}
          <section aria-labelledby="opportunity-compensation-heading" className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <div className="border-b border-border/60 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">02 · Compensation</p>
              <h2 id="opportunity-compensation-heading" className="flex items-center gap-2 text-base font-semibold">
                <DollarSign className="h-4 w-4 text-muted-foreground" /> Budget and rate
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Share a range, or mark the fee as open for discussion.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setRateType('hourly')}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${rateType === 'hourly' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border/60 text-muted-foreground hover:border-primary/40'}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setRateType('fixed')}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${rateType === 'fixed' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border/60 text-muted-foreground hover:border-primary/40'}`}
              >
                Fixed Project
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-20 h-10 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                aria-label={`Minimum ${rateType === 'hourly' ? 'hourly rate' : 'project budget'}`}
                placeholder={rateType === 'hourly' ? 'Minimum /hr' : 'Minimum'}
                value={budgetMin}
                onChange={e => setBudgetMin(e.target.value)}
                className="h-10 flex-1 rounded-xl"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                min={0}
                aria-label={`Maximum ${rateType === 'hourly' ? 'hourly rate' : 'project budget'}`}
                placeholder={rateType === 'hourly' ? 'Maximum /hr' : 'Maximum'}
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                className="h-10 flex-1 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <Label htmlFor="feeDiscussion" className="font-medium">Fee is open to discussion</Label>
                <p className="mt-1 text-xs text-muted-foreground">Invite applicants to propose a fee and discuss terms with you.</p>
              </div>
              <Switch id="feeDiscussion" checked={feeDiscussion} onCheckedChange={setFeeDiscussion} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeDetails">Additional fee and payment terms <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="feeDetails"
                maxLength={1800}
                value={feeDetails}
                onChange={event => setFeeDetails(event.target.value)}
                placeholder="Describe how the fee is set or negotiated, payment timing, milestones, or revenue-share terms."
                className="min-h-[90px] rounded-xl text-sm"
              />
              <p className="text-xs text-muted-foreground">Applicants can include a proposed fee when they message you. QuillHive does not process or hold payments.</p>
            </div>
          </section>

          <section aria-labelledby="opportunity-scope-heading" className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <div className="border-b border-border/60 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">03 · Scope</p>
              <h2 id="opportunity-scope-heading" className="mt-1 text-lg font-semibold">Scope and requirements</h2>
              <p className="mt-1 text-sm text-muted-foreground">Explain the work and what applicants need to bring.</p>
            </div>
          {/* Required Skills */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-semibold">
              <Tag className="w-4 h-4" /> Required Skill Badges
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. React, Technical Writing, Rust"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                className="h-10 rounded-xl flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={addSkill} className="h-10 rounded-xl px-3 min-w-[44px]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map(s => (
                  <Badge key={s} variant="secondary" className="gap-1.5 pr-1 pl-2.5 py-1 text-xs rounded-lg">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-destructive transition-colors min-w-[20px] min-h-[20px] flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Proof Criterion */}
          <div className="space-y-2">
            <Label htmlFor="outputCriteria" className="flex items-center gap-1.5 text-sm font-semibold">
              <FileCheck className="w-4 h-4" /> Proof Criterion
              <span className="text-xs font-normal text-muted-foreground">(what creators must submit to qualify)</span>
            </Label>
            <Textarea
              id="outputCriteria"
              placeholder="e.g. A published article demonstrating knowledge of Rust async patterns, with code samples"
              value={outputCriteria}
              onChange={e => setOutputCriteria(e.target.value)}
              className="rounded-xl min-h-[80px] text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Full description <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the role, expectations, timeline, and what success looks like…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="rounded-xl min-h-[120px] text-sm"
            />
          </div>
          </section>

          <section aria-labelledby="opportunity-arrangement-heading" className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <div className="border-b border-border/60 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">04 · Logistics</p>
              <h2 id="opportunity-arrangement-heading" className="mt-1 text-lg font-semibold">Organization and work arrangement</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add the organization and where the work will take place.</p>
            </div>
          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-sm font-semibold">Company / Organization</Label>
            <Input
              id="companyName"
              placeholder="Optional - leave blank to post as individual"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          {/* Remote + Location */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Remote</span>
            </div>
            <Switch checked={remote} onCheckedChange={setRemote} />
          </div>
          {!remote && (
            <div className="space-y-2">
              <Label htmlFor="loc" className="flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" /> Location
              </Label>
              <Input id="loc" placeholder="City, Country" value={location} onChange={e => setLocation2(e.target.value)} className="h-10 rounded-xl" />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
            <div>
              <p className="text-sm font-medium">Opportunity active</p>
              <p className="text-xs text-muted-foreground">Inactive opportunities are visible only to you.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiresAt" className="flex items-center gap-1.5 text-sm font-semibold">
              <Calendar className="h-4 w-4" /> Opportunity end date and time
            </Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              min={toLocalDateTimeValue(new Date(Date.now() + 60_000))}
              value={expiresAt}
              onChange={event => setExpiresAt(event.target.value)}
              required
              className="h-10 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Applications close automatically when this time is reached. The default is 30 days from now.</p>
          </div>
          </section>

          {/* Apply methods */}
          <section aria-labelledby="opportunity-application-heading" className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="border-b border-border/60 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">05 · Applications</p>
            <h2 id="opportunity-application-heading" className="mt-1 text-lg font-semibold">How to apply</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add an external application link, an email address, or both.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="applyUrl" className="flex items-center gap-1.5 text-xs font-semibold">
                <LinkIcon className="w-3.5 h-3.5" /> Apply URL
              </Label>
              <Input id="applyUrl" placeholder="https://your-apply-link.com" value={applyUrl} onChange={e => setApplyUrl(e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="applyEmail" className="flex items-center gap-1.5 text-xs font-semibold">
                <Mail className="w-3.5 h-3.5" /> Apply Email
              </Label>
              <Input id="applyEmail" type="email" placeholder="hiring@yourcompany.com" value={applyEmail} onChange={e => setApplyEmail(e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-3">
            QuillHive helps you discover and connect with opportunities. Any payment arrangement is made directly between you and the other party — QuillHive does not process, hold, or guarantee any payment made outside the platform. Always verify who you're working with before sending money or sensitive information.
          </p>
          </section>

          {/* Submit */}
          {submitError && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{submitError}</div>}
          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Your listing will close automatically at its deadline.</p>
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl font-semibold text-base gap-2 shadow-sm sm:w-auto sm:min-w-52"
            disabled={isSubmitting || isLoadingEdit}
          >
            {isSubmitting || isLoadingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            {isLoadingEdit ? 'Loading…' : isSubmitting ? 'Saving…' : editId ? 'Save changes' : 'Post opportunity'}
          </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
