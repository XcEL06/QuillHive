import { useState, useRef, useEffect } from 'react';
import { useCreatePost } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { AttachmentPicker, type Attachment } from './AttachmentPicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SPARK_MAX = 280;

const FEELINGS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'thinking', emoji: '🤔', label: 'Thinking' },
  { id: 'grateful', emoji: '🙏', label: 'Grateful' },
  { id: 'excited', emoji: '🎉', label: 'Excited' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'inspired', emoji: '✨', label: 'Inspired' },
  { id: 'curious', emoji: '👀', label: 'Curious' },
  { id: 'love', emoji: '❤️', label: 'Love' },
];

export function SparkComposer({ onPosted, prompt, placeholder }: { onPosted?: () => void; prompt?: string; placeholder?: string }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();

  const [content, setContent] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const { mutate: createPost, isPending } = useCreatePost({
    mutation: {
      onSuccess: () => {
        const isFirstPost = (user?.postsCount ?? 1) === 0;
        setContent('');
        setFeeling(null);
        setVisibility('public');
        setAttachments([]);
        setExpanded(false);
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        if (isFirstPost) {
          toast({
            title: '🎉 Your first spark is live!',
            description: "We're showing it to the QuillHive community now - you'll appear in the Fresh Voices section for new readers to discover.",
            duration: 8000,
          });
        } else {
          toast({ title: t('spark.posted', 'Spark posted!') });
        }
        onPosted?.();
      },
      onError: (err: Error) => {
        toast({
          title: t('common.error', 'Something went wrong'),
          description: err?.message || t('spark.failed', 'Could not post your spark.'),
          variant: 'destructive',
        });
      },
    },
  });

  const remaining = SPARK_MAX - content.length;
  const overLimit = remaining < 0;
  const canSubmit = (content.trim().length > 0 || attachments.length > 0) && !overLimit && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const tags = feeling ? [`feeling:${feeling}`] : [];
    createPost({
      data: {
        content: content.trim() || ' ',
        type: 'spark' as import('@workspace/api-client-react').CreatePostRequestType,
        tags,
        visibility,
        isPublished: true,
        ...({ attachments } as object),
      },
    });
  };

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/60 rounded-2xl p-4 mb-6 shadow-sm hover:border-primary/30 transition-colors"
    >
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 border border-border flex-shrink-0">
          <AvatarImage src={user.avatarUrl || ''} />
          <AvatarFallback className="bg-amber-500/10 text-amber-600">
            {user.displayName?.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {prompt && <p className="text-sm font-semibold text-foreground mb-1">{prompt}</p>}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder={placeholder ?? t('spark.placeholder', "What's on your mind? Share a quick spark...")}
            rows={1}
            className="w-full resize-none bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground py-2"
            maxLength={SPARK_MAX + 50}
          />

          <AnimatePresence>
            {(expanded || content.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-border/50"
              >
                <div className="flex items-center gap-2 relative flex-wrap">
                  <AttachmentPicker
                    attachments={attachments}
                    onChange={setAttachments}
                    max={20}
                    label=""
                    compact
                  />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFeelingOpen((v) => !v)}
                    className="rounded-full text-xs gap-1.5 h-8 px-2.5 text-amber-600 hover:bg-amber-500/10"
                  >
                    {feeling ? (
                      <>
                        <span>{FEELINGS.find((f) => f.id === feeling)?.emoji}</span>
                        <span>{FEELINGS.find((f) => f.id === feeling)?.label}</span>
                      </>
                    ) : (
                      <>
                        <Smile className="w-3.5 h-3.5" />
                        <span>{t('spark.feeling', 'Feeling')}</span>
                      </>
                    )}
                  </Button>
                  {feelingOpen && (
                    <div className="absolute top-full left-0 mt-1 z-10 bg-popover border border-border rounded-xl shadow-lg p-2 grid grid-cols-4 gap-1 w-56">
                      {FEELINGS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setFeeling(f.id); setFeelingOpen(false); }}
                          className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted text-xs"
                        >
                          <span className="text-xl">{f.emoji}</span>
                          <span className="text-[10px] text-muted-foreground">{f.label}</span>
                        </button>
                      ))}
                      {feeling && (
                        <button
                          type="button"
                          onClick={() => { setFeeling(null); setFeelingOpen(false); }}
                          className="col-span-4 text-xs text-muted-foreground hover:text-destructive py-1.5"
                        >
                          {t('spark.clearFeeling', 'Clear feeling')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs tabular-nums ${
                      overLimit
                        ? 'text-destructive font-semibold'
                        : remaining < 30
                        ? 'text-amber-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {remaining}
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    size="sm"
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm gap-1.5 h-8"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    )}
                    {t('spark.post', 'Spark')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
