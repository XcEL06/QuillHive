import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplyOpportunityActions } from '@/components/opportunities/ApplyOpportunityActions';
import { OpportunityShareDialog } from '@/components/opportunities/OpportunityShareDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiUrl, getStoredToken } from '@/lib/api';
import { ArrowLeft, Briefcase, Calendar, Clock, DollarSign, MapPin, Check, X, CheckCircle2 } from 'lucide-react';
import { Timestamp } from '@/lib/postTimestamp';
import { useAuthStore } from '@/store/auth';

type Opportunity = {
  id: number;
  title: string;
  description: string;
  type: string;
  skills: string[];
  compensation?: string | null;
  feeDetails?: string | null;
  expiresAt?: string | null;
  remote?: boolean;
  location?: string | null;
  companyName?: string | null;
  applyUrl?: string | null;
  applyEmail?: string | null;
  authorId: number;
  isActive: boolean;
  createdAt: string;
  author: { username: string; displayName: string; avatarUrl?: string | null };
};

type OpportunityApplication = {
  id: number;
  applicantId: number;
  message?: string | null;
  proposedBudget?: number | null;
  proposedCurrency: string;
  status: string;
  conversationId?: number | null;
  completionRequestedById?: number | null;
  completedAt?: string | null;
  isMine?: boolean;
  isOwner?: boolean;
  createdAt: string;
  applicant: { username: string; displayName: string; avatarUrl?: string | null };
};

export default function OpportunityDetail() {
  const [, params] = useRoute('/opportunities/:id');
  const { user } = useAuthStore();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [applicationsError, setApplicationsError] = useState('');
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    let active = true;
    const token = getStoredToken();
    fetch(apiUrl(`/api/jobs/${encodeURIComponent(params.id)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Opportunity not found');
        return data as Opportunity;
      })
      .then(data => { if (active) setOpportunity(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load opportunity'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params?.id]);

  const isOwner = Boolean(opportunity && user?.id === opportunity.authorId);

  useEffect(() => {
    if (!user || !opportunity) {
      setApplications([]);
      setApplicationsError('');
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    let active = true;
    setApplicationsLoading(true);
    setApplicationsError('');
    fetch(apiUrl(`/api/jobs/applications?jobId=${opportunity.id}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load applications');
        return data;
      })
      .then(data => {
        if (active) setApplications(Array.isArray(data?.applications) ? data.applications : []);
      })
      .catch(reason => {
        if (active) setApplicationsError(reason instanceof Error ? reason.message : 'Could not load applications');
      })
      .finally(() => { if (active) setApplicationsLoading(false); });
    return () => { active = false; };
  }, [isOwner, opportunity?.id, user?.id]);

  const updateApplication = async (application: OpportunityApplication, action: 'accepted' | 'rejected' | 'cancelled') => {
    const token = getStoredToken();
    const response = await fetch(apiUrl(`/api/jobs/applications/${application.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: ["Bearer", token].join(" ") } : {}) },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not update application');
    setApplications(current => current.map(item => item.id === application.id ? { ...item, ...data.application, room: data.room } : item));
  };

  const updateCompletion = async (application: OpportunityApplication, action: 'request' | 'confirm') => {
    const token = getStoredToken();
    const response = await fetch(apiUrl(`/api/jobs/applications/${application.id}/completion`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: ["Bearer", token].join(" ") } : {}) },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not update project completion');
    setApplications(current => current.map(item => item.id === application.id ? { ...item, ...data.application } : item));
  };

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Button asChild variant="ghost" className="mb-5 -ml-3 gap-2">
          <Link href="/workspace?tab=work"><ArrowLeft className="h-4 w-4" /> Opportunities</Link>
        </Button>
        {loading ? (
          <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40 w-full" /></div>
        ) : error || !opportunity ? (
          <div className="py-16 text-center"><Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h1 className="text-xl font-semibold">Opportunity unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error || 'This opportunity may have closed.'}</p></div>
        ) : (
          <article className="space-y-7">
            <header className="border-b border-border/70 pb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">{opportunity.type}</Badge>
                {!opportunity.isActive && <Badge variant="secondary">Closed</Badge>}
                {opportunity.companyName && <span className="text-sm text-muted-foreground">at {opportunity.companyName}</span>}
              </div>
              <h1 className="text-3xl font-semibold text-foreground">{opportunity.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {opportunity.compensation && <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4" />{opportunity.compensation}</span>}
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{opportunity.remote ? 'Remote' : opportunity.location || 'Location not specified'}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /><Timestamp value={opportunity.createdAt} /></span>
                {opportunity.expiresAt && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Application deadline: {new Date(opportunity.expiresAt).toLocaleString()}</span>}
              </div>
            </header>
            <section>
              <h2 className="mb-2 text-sm font-semibold">About this opportunity</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">{opportunity.description}</p>
            </section>
            {opportunity.feeDetails && <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><DollarSign className="h-4 w-4" />Fee and payment terms</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">{opportunity.feeDetails}</p>
              <p className="mt-3 text-xs text-muted-foreground">Discuss and agree on payment directly with the other participant. QuillHive does not process or hold payments.</p>
            </section>}
            {(isOwner || applications.some(application => application.isMine)) && <section className="space-y-3 border-t border-border/70 pt-5">
              <h2 className="text-sm font-semibold">{isOwner ? `Applications (${applications.length})` : 'Your application'}</h2>
              {applicationsLoading ? <Skeleton className="h-20 w-full" /> : applicationsError ? (
                <p className="text-sm text-destructive" role="alert">{applicationsError}</p>
              ) : applications.filter(application => isOwner || application.isMine).length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : applications.filter(application => isOwner || application.isMine).map(application => (
                <article key={application.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={application.applicant.avatarUrl || ''} /><AvatarFallback>{application.applicant.displayName.slice(0, 1)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <Link href={`/profile/${encodeURIComponent(application.applicant.username)}`} className="text-sm font-semibold hover:text-primary hover:underline">{application.applicant.displayName}</Link>
                      <p className="text-xs text-muted-foreground">@{application.applicant.username} · <Timestamp value={application.createdAt} /></p>
                      {application.message && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/85">{application.message}</p>}
                      {application.proposedBudget != null && <p className="mt-1 text-xs text-muted-foreground">Proposed {application.proposedCurrency} {application.proposedBudget}</p>}
                      <p className="mt-1 text-xs capitalize text-muted-foreground">Status: {application.status}</p>
                      {application.status === 'accepted' && <p className="mt-1 text-xs text-muted-foreground">A project workspace is available. Acceptance does not mean payment has been made.</p>}
                      {application.status === 'completed' && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Completion confirmed by both participants.</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {application.conversationId && <Button asChild variant="outline" size="sm"><Link href={`/messages/${application.conversationId}`}>Open conversation</Link></Button>}
                    {application.status === 'pending' && application.isOwner && <>
                      <Button size="sm" onClick={() => void updateApplication(application, 'accepted').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not accept application'))}><Check className="mr-1 h-4 w-4" />Accept and create workspace</Button>
                      <Button size="sm" variant="outline" onClick={() => void updateApplication(application, 'rejected').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not reject application'))}><X className="mr-1 h-4 w-4" />Reject</Button>
                    </>}
                    {application.status === 'pending' && application.isMine && <Button size="sm" variant="outline" onClick={() => void updateApplication(application, 'cancelled').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not cancel application'))}>Cancel application</Button>}
                    {application.status === 'accepted' && (application.isMine || application.isOwner) && <>
                      {application.completionRequestedById == null
                        ? <Button size="sm" variant="outline" onClick={() => void updateCompletion(application, 'request').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not request completion'))}>Request completion</Button>
                        : application.completionRequestedById !== user?.id
                          ? <Button size="sm" onClick={() => void updateCompletion(application, 'confirm').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not confirm completion'))}><CheckCircle2 className="mr-1 h-4 w-4" />Confirm completion</Button>
                          : <span className="self-center text-xs text-muted-foreground">Waiting for the other participant to confirm completion</span>}
                      <Button size="sm" variant="ghost" onClick={() => void updateApplication(application, 'cancelled').catch(error => setApplicationsError(error instanceof Error ? error.message : 'Could not cancel project'))}>Cancel project</Button>
                    </>}
                  </div>
                </article>
              ))}
            </section>}
            {opportunity.skills?.length > 0 && <section><h2 className="mb-2 text-sm font-semibold">Skills</h2><div className="flex flex-wrap gap-2">{opportunity.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div></section>}
            <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-5">
              <Link href={`/profile/${encodeURIComponent(opportunity.author.username)}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
                <Avatar className="h-10 w-10"><AvatarImage src={opportunity.author.avatarUrl || ''} /><AvatarFallback>{opportunity.author.displayName.slice(0, 1)}</AvatarFallback></Avatar>
                <span className="truncate text-sm font-medium">Posted by {opportunity.author.displayName}</span>
              </Link>
              <div className="flex items-center gap-2">
                <OpportunityShareDialog opportunityId={opportunity.id} title={opportunity.title} />
                {!isOwner && <ApplyOpportunityActions jobId={opportunity.id} title={opportunity.title} closed={!opportunity.isActive} externalHref={opportunity.applyUrl || (opportunity.applyEmail ? `mailto:${opportunity.applyEmail}` : undefined)} />}
              </div>
            </footer>
          </article>
        )}
      </main>
    </AppLayout>
  );
}