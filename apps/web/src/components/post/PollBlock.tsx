import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BarChart3, Check, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'wouter';

interface PollVoter {
  voteId: number;
  optionId: number;
  votedAt: string;
  user: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
}

interface PollOption {
  id: number;
  label: string;
  position: number;
  voteCount: number;
}

interface PollData {
  id: number;
  postId: number;
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  myVotes: number[];
  options: PollOption[];
}

export function PollBlock({ postId }: { postId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<PollData | null>({
    queryKey: ['/api/polls/post', postId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/polls/post/${postId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    retry: false,
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [votersOption, setVotersOption] = useState<{ id: number; label: string } | null>(null);

  const { data: voters, isLoading: loadingVoters } = useQuery<PollVoter[]>({
    queryKey: ['/api/polls', data?.id, 'voters', votersOption?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/polls/${data!.id}/voters?optionId=${votersOption!.id}`);
      return res.json();
    },
    enabled: !!votersOption && !!data,
  });

  useEffect(() => {
    if (data?.myVotes) setSelected(new Set(data.myVotes));
  }, [data?.myVotes]);

  const vote = useMutation({
    mutationFn: async (optionIds: number[]) => {
      const res = await apiRequest('POST', `/api/polls/${data!.id}/vote`, { optionIds });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/polls/post', postId] }),
    onError: (error) => toast({
      title: 'Could not vote',
      description: error instanceof Error ? error.message : 'Please try again.',
      variant: 'destructive',
    }),
  });

  if (isLoading || error || !data) return null;

  const hasVoted = data.myVotes.length > 0;
  const total = Math.max(1, data.totalVotes);

  function toggle(optionId: number) {
    if (data!.isClosed) return;
    if (data!.allowMultiple) {
      const next = new Set(selected);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      setSelected(next);
    } else {
      setSelected(new Set([optionId]));
    }
  }

  function submit() {
    if (selected.size === 0) return;
    vote.mutate(Array.from(selected));
  }

  return (
    <div className="my-8 border border-border rounded-2xl p-5 bg-card/40">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-foreground">{data.question}</h4>
      </div>

      <div className="space-y-2">
        {data.options.map((o) => {
          const pct = hasVoted ? Math.round((o.voteCount / total) * 100) : 0;
          const isSelected = selected.has(o.id);
          const isMyVote = data.myVotes.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={data.isClosed || vote.isPending}
              className={`relative w-full text-left rounded-lg border px-3 py-2.5 transition-colors overflow-hidden ${
                isSelected || isMyVote ? 'border-primary' : 'border-border hover:border-foreground/30'
              } ${data.isClosed ? 'opacity-80 cursor-default' : ''}`}
            >
              {hasVoted && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  {isMyVote && <Check className="w-3.5 h-3.5 text-primary" />}
                  {o.label}
                </span>
                {hasVoted && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {pct}% · {o.voteCount}
                    {o.voteCount > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setVotersOption({ id: o.id, label: o.label }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setVotersOption({ id: o.id, label: o.label }); } }}
                        className="inline-flex items-center gap-1 hover:text-primary cursor-pointer"
                        data-testid={`poll-voters-${o.id}`}
                      >
                        <Users className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        <span>
          {data.totalVotes} {data.totalVotes === 1 ? 'vote' : 'votes'}
          {data.isClosed && ' · closed'}
          {data.allowMultiple && ' · multi-select'}
        </span>
        {!data.isClosed && (
          <Button size="sm" onClick={submit} disabled={selected.size === 0 || vote.isPending}>
            {vote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            {hasVoted ? 'Update vote' : 'Vote'}
          </Button>
        )}
      </div>

      <Dialog open={!!votersOption} onOpenChange={(o) => !o && setVotersOption(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Voters · {votersOption?.label}</DialogTitle>
          </DialogHeader>
          {loadingVoters ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !voters || voters.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No voters yet.</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {voters.map((v) => (
                <li key={v.voteId} className="py-2.5">
                  <Link href={`/profile/${v.user.username}`} className="flex items-center gap-3 hover:bg-muted/40 rounded-md px-2">
                    {v.user.avatarUrl ? (
                      <img src={v.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {(v.user.displayName ?? v.user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{v.user.displayName ?? v.user.username}</div>
                      <div className="text-xs text-muted-foreground truncate">@{v.user.username}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
