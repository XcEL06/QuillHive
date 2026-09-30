import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { getStoredToken } from '@/lib/api';
import { Loader2, Zap, Wand2 } from 'lucide-react';
import { AttachmentPicker, type Attachment } from '@/components/post/AttachmentPicker';
import { BackButton } from '@/components/ui/BackButton';

const MAX_CHARS = 280;

export default function SparksNew() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [makingPunchier, setMakingPunchier] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_CHARS - content.length;
  const counterColor = remaining <= 10 ? 'text-destructive' : remaining <= 40 ? 'text-amber-500' : 'text-muted-foreground';

  const handlePublish = async () => {
    if (!content.trim() && attachments.length === 0) return;
    setPublishing(true);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: content.trim() || ' ', type: 'spark', visibility, attachments, isPublished: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to publish');
      }
      toast({ title: 'Spark posted' });
      navigate('/');
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleMakePunchier = async () => {
    if (!content.trim()) return;
    setMakingPunchier(true);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: content.trim(), focus: 'punchy' }),
      });
      if (res.ok) {
        const data = await res.json() as { result?: string; improved?: string };
        const improved = data.result ?? data.improved;
        if (improved) setContent(improved.slice(0, MAX_CHARS));
      }
    } catch {
      /* silent */
    } finally {
      setMakingPunchier(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        <BackButton />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">New Spark</h1>
            <p className="text-xs text-muted-foreground">Share a quick burst of an idea</p>
          </div>
        </div>

        {/* Main compose card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="What's sparking your mind?"
              rows={6}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base placeholder:text-muted-foreground focus:outline-none leading-relaxed"
            />
            {/* Character counter */}
            <div className={`absolute bottom-2 right-3 text-xs font-mono font-medium tabular-nums ${counterColor}`}>
              {remaining}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/50">
            <div className="flex items-center gap-1">
              <AttachmentPicker attachments={attachments} onChange={setAttachments} max={20} compact label="Media" />
              <Select value={visibility} onValueChange={(value: 'public' | 'followers' | 'private') => setVisibility(value)}>
                <SelectTrigger className="h-8 w-auto min-w-28 rounded-full border-0 bg-muted/50 px-3 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="followers">Followers</SelectItem>
                  <SelectItem value="private">Only me</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={handleMakePunchier}
                disabled={!content.trim() || makingPunchier}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 disabled:opacity-50 transition-colors"
              >
                {makingPunchier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Make it punchier
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')} className="rounded-xl h-8">Cancel</Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={(!content.trim() && attachments.length === 0) || publishing || content.length > MAX_CHARS}
                className="rounded-xl h-8 bg-amber-500 hover:bg-amber-600 text-white px-5"
              >
                {publishing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Publishing</> : '⚡ Spark'}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-3">Sparks are short, punchy ideas. No title needed.</p>
      </div>
    </AppLayout>
  );
}
