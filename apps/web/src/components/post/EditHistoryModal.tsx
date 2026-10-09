import { useEffect, useState } from 'react';
import { Timestamp } from '@/lib/postTimestamp';
import { History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getStoredToken } from '@/lib/api';

interface VersionRow {
  id: number;
  editorId: number;
  title: string | null;
  excerpt: string | null;
  changeReason: string | null;
  createdAt: string;
  contentLength: number;
}

export function EditHistoryModal({
  postId,
  open,
  onOpenChange,
}: {
  postId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = getStoredToken();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/posts/${postId}/versions`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 403 ? 'Only the author can view edit history.' : 'Could not load edit history.');
          return [] as VersionRow[];
        }
        return (await r.json()) as VersionRow[];
      })
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load edit history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/50 sm:max-w-md" data-testid="edit-history-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Edit history
          </DialogTitle>
          <DialogDescription>Past versions of this post.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-muted-foreground">{error}</p>
        )}

        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-muted-foreground">No previous versions yet.</p>
        )}

        {!loading && !error && versions.length > 0 && (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {versions.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-border/50 p-3 text-sm"
                data-testid={`edit-history-row-${v.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground line-clamp-1">
                    {v.title || 'Untitled'}
                  </span>
                  <Timestamp value={v.createdAt} className="text-xs text-muted-foreground shrink-0" />
                </div>
                {v.excerpt && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{v.excerpt}</p>
                )}
                {v.changeReason && (
                  <p className="text-xs italic text-muted-foreground/80 mt-1">
                    “{v.changeReason}”
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {v.contentLength.toLocaleString()} characters
                </p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
