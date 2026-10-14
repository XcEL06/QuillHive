import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiUrl, getStoredToken } from '@/lib/api';

type ReportTarget = 'post' | 'comment' | 'user' | 'message' | 'job' | 'other';

type ReportDialogProps = {
  targetType: ReportTarget;
  targetId: number;
  label?: string;
  className?: string;
};

const reasons = [
  { value: 'scam_fraud', label: 'Scam/Fraud' },
  { value: 'impersonation', label: 'Fake profile' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
] as const;

export function ReportDialog({
  targetType,
  targetId,
  label = 'Report',
  className,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: ReportDialogProps & { open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const { toast } = useToast();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [reason, setReason] = useState<(typeof reasons)[number]['value']>('spam');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const response = await fetch(apiUrl('/api/support/report'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}),
        },
        body: JSON.stringify({ targetType, targetId, reason, category: reason, details: details.trim() || undefined }),
      });
      if (!response.ok) throw new Error('Could not submit report');
      setOpen(false);
      setDetails('');
      toast({ title: 'Report submitted', description: 'Thanks. Our team will review it.' });
    } catch {
      toast({ title: 'Could not submit report', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!hideTrigger && <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Flag className="mr-1.5 h-3.5 w-3.5" /> {label}
      </Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report {targetType === 'message' ? 'message' : targetType}</DialogTitle>
            <DialogDescription>Choose a reason and add context if helpful.</DialogDescription>
          </DialogHeader>
          <label className="space-y-1.5 text-sm font-medium">
            Reason
            <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Optional details" maxLength={2_000} rows={4} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void submit()} disabled={sending}>{sending ? 'Sending...' : 'Send report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
