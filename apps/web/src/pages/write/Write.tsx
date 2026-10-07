import { useState, useEffect, useRef, type ComponentType } from 'react';
import { useLocation } from 'wouter';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useCreatePost } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Image as ImageIcon, Tags, Send, Save,
  Bold, Italic, Underline as UnderlineIcon,
  Heading1, Heading2, List, ListOrdered, Quote, Loader2, X,
  Lightbulb, Wand2, MessageSquare, ChevronRight, Clock, FlaskConical, Calendar, Rocket,
  Video, ChevronDown, ChevronUp, Newspaper, Type, Hash, Copy, Check, BookOpen, ArrowUpRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AttachmentPicker } from '@/components/post/AttachmentPicker';
import { useT } from '@/lib/i18n';
import { ImageUploadField } from '@/components/media/ImageUploadField';
import { BackButton } from '@/components/ui/BackButton';
import { apiUrl } from '@/lib/api';
import { reportCaughtError } from '@/lib/reportCaughtError';
import { useFeature } from '@/lib/features';

type AiPanel = 'assist' | 'caption' | 'improve' | 'ideas' | 'titles' | 'hashtags' | null;

const PRIMARY_POST_TYPES = [
  {
    value: 'post',
    label: 'Post',
    icon: Newspaper,
    desc: 'Professional writing, deep dives & proof of work',
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
    activeBg: 'bg-primary/15 border-primary',
  },
  {
    value: 'artwork',
    label: 'Motion',
    icon: Video,
    desc: 'Video pitches & creative showcases',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10 border-rose-500/30',
    activeBg: 'bg-rose-500/15 border-rose-500',
  },
] as const;

const ADVANCED_POST_TYPES: { value: string; label: string; icon: ComponentType<{ className?: string }> }[] = [];

interface ChallengeContext {
  id: number;
  title: string;
  prompt: string;
  wordLimit: number | null;
  endsAt: string;
}

interface LinkPreview {
  url: string;
  title: string;
  image: string | null;
  description: string | null;
}

function findStandaloneUrl(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const candidate = line.trim();
    if (/^https?:\/\/[^\s<>'"]+$/.test(candidate)) return candidate;
  }
  return null;
}

function normalizePostType(type: unknown): string {
  if (typeof type !== 'string' || !type || type === 'spark' || type === 'blog' || type === 'note') {
    return 'post';
  }
  return type;
}

export default function Write() {
  const editPostId = (() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const value = Number(new URLSearchParams(search).get('edit'));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  })();
  usePageTitle(editPostId ? 'Edit post' : 'Write');
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const { user, token } = useAuthStore();
  const aiToolsAvailable = useFeature('ai_tools_enabled') && (user?.role === 'admin' || user?.role === 'super_admin');
  const queryClient = useQueryClient();
  const challengeId = (() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const match = /[?&]challenge=(\d+)/.exec(search);
    return match ? Number.parseInt(match[1], 10) : null;
  })();
  const quoteId = (() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const match = /[?&]quote=(\d+)/.exec(search);
    return match ? Number.parseInt(match[1], 10) : null;
  })();
  const [quoteTargetId, setQuoteTargetId] = useState<number | null>(quoteId);
  const [quotedPost, setQuotedPost] = useState<any>(null);
  const [challengeCtx, setChallengeCtx] = useState<ChallengeContext | null>(null);
  const [originalityWarning, setOriginalityWarning] = useState<string | null>(null);
  const [originalityChecking, setOriginalityChecking] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('post');
  const [tagsStr, setTagsStr] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [postAttachments, setPostAttachments] = useState<import('@/components/post/AttachmentPicker').Attachment[]>([]);
  const [isLoadingEdit, setIsLoadingEdit] = useState(Boolean(editPostId));
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [enableAB, setEnableAB] = useState(false);
  const [titleA, setTitleA] = useState('');
  const [titleB, setTitleB] = useState('');

  useEffect(() => {
    if (!quoteId || !token) return;
    fetch(`/api/posts/${quoteId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.ok ? res.json() : null)
      .then((post) => setQuotedPost(post))
      .catch(() => setQuotedPost(null));
  }, [quoteId, token]);

  const [boostCtaPostId, setBoostCtaPostId] = useState<number | null>(null);
  const [serverDraftId, setServerDraftId] = useState<number | null>(null);
  const serverDraftIdRef = useRef<number | null>(serverDraftId);
  const draftSavePromiseRef = useRef<Promise<boolean> | null>(null);
  serverDraftIdRef.current = serverDraftId;

  const { mutate: createPost, isPending: isCreating } = useCreatePost({
    mutation: {
      onSuccess: (post) => {
        try { localStorage.removeItem(`qh_draft_${user?.id || 'anon'}`); } catch { }
        setServerDraftId(null);
        serverDraftIdRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        if ((post as any).isPublished) {
          const isFirstPost = ((user as any)?.postsCount ?? 1) === 0;
          if (isFirstPost) {
            toast({
              title: '🎉 Your first post is live!',
              description: "We're boosting your visibility to the QuillHive community for the next 30 days - your post will appear in the Fresh Voices section for new readers to discover.",
              duration: 8000,
            });
          } else {
            toast({ title: t('write.published'), description: t('write.publishedDesc') });
          }
          setBoostCtaPostId(post.id);
        } else {
          toast({ title: t('write.published'), description: t('write.publishedDesc') });
          setLocation(`/post/${post.id}`);
        }
      },
      onError: (err: unknown) => {
        const errorObj = err as {
          message?: string;
          status?: number;
          response?: { status?: number; data?: { error?: string; message?: string; similarPostIds?: number[] } };
          data?: { error?: string; message?: string; similarPostIds?: number[] };
        };
        const data = errorObj?.response?.data ?? errorObj?.data;
        const status = errorObj?.response?.status ?? errorObj?.status;
        if (status === 409 || data?.error === 'DUPLICATE_CONTENT') {
          toast({
            title: t('write.duplicateContent'),
            description: data?.message || t('write.duplicateContentDesc'),
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: t('write.publishError'),
          description: errorObj?.message || t('write.publishErrorDesc'),
          variant: 'destructive',
        });
      }
    }
  });

  const [seriesId, setSeriesId] = useState('');
  const [mySeries, setMySeries] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/series', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => { if (Array.isArray(data)) setMySeries(data as { id: number; title: string }[]); })
      .catch(() => {});
  }, [token]);

  const [aiPanel, setAiPanel] = useState<AiPanel>(null);
  const [aiMode, setAiMode] = useState('continue');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const [captionTopic, setCaptionTopic] = useState('');
  const [captionTone, setCaptionTone] = useState('');
  const [improveContent, setImproveContent] = useState('');
  const [improveFocus, setImproveFocus] = useState('clarity');
  const [ideasTheme, setIdeasTheme] = useState('');
  const [ideasGenre, setIdeasGenre] = useState('');
  const [ideasMood, setIdeasMood] = useState('');
  const [aiTitleSuggestions, setAiTitleSuggestions] = useState<string[]>([]);
  const [aiHashtagSuggestions, setAiHashtagSuggestions] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [isLinkPreviewLoading, setIsLinkPreviewLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: t('write.editorPlaceholder') })
    ],
    content: '',
    onUpdate: ({ editor: updatedEditor }) => setContent(updatedEditor.getHTML()),
    editorProps: {
      attributes: {
        class: 'qh-editor focus:outline-none min-h-[40vh] max-w-none px-4 py-8',
      },
    },
  });

  useEffect(() => {
    if (!editPostId || !editor?.isInitialized) return;
    if (!token || !user) {
      setIsLoadingEdit(false);
      toast({ title: 'Sign in to edit this post', variant: 'destructive' });
      setLocation('/login');
      return;
    }

    let active = true;
    setIsLoadingEdit(true);
    fetch(apiUrl(`/api/posts/${editPostId}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Post not found.' : 'Could not load this post for editing.');
        }
        return response.json() as Promise<Record<string, any>>;
      })
      .then((post) => {
        if (!active) return;
        const authorId = Number(post.author?.id ?? post.authorId);
        if (authorId !== Number(user.id)) throw new Error('You can only edit your own posts.');

        setTitle(post.title ?? '');
        setType(normalizePostType(post.type));
        setTagsStr(Array.isArray(post.tags)
          ? post.tags.join(', ')
          : typeof post.tags === 'string'
            ? (() => { try { const tags = JSON.parse(post.tags); return Array.isArray(tags) ? tags.join(', ') : ''; } catch { return ''; } })()
            : '');
        setImageUrl(post.imageUrl ?? '');
        setOriginalImageUrl(post.imageUrl ?? '');
        let attachments = post.attachments;
        if (typeof attachments === 'string') {
          try { attachments = JSON.parse(attachments); } catch { attachments = []; }
        }
        setPostAttachments(Array.isArray(attachments) ? attachments : []);
        editor.commands.setContent(post.content ?? '');
        setDraftRestored(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast({
          title: 'Could not edit post',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
        setLocation('/');
      })
      .finally(() => {
        if (active) setIsLoadingEdit(false);
      });

    return () => { active = false; };
  }, [editPostId, editor, token, user?.id, toast, setLocation]);

  useEffect(() => {
    const standaloneUrl = editor?.isInitialized ? findStandaloneUrl(editor.getText()) : null;
    if (!standaloneUrl || !token) {
      setLinkPreview(null);
      setIsLinkPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLinkPreviewLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/embed/link-preview?url=${encodeURIComponent(standaloneUrl)}`), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Preview unavailable');
        setLinkPreview(await response.json() as LinkPreview);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setLinkPreview(null);
      } finally {
        if (!controller.signal.aborted) setIsLinkPreviewLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [content, editor, token]);

  const [showAdvancedTypes, setShowAdvancedTypes] = useState(false);

  // ─── Draft autosave ───────────────────────────────────────────
  const DRAFT_KEY = `qh_draft_${user?.id || 'anon'}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  // Load server draft from URL param ?draftId=X (used from /drafts page "Resume editing")
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const draftIdParam = params.get('draftId');
    if (editPostId || !draftIdParam || !editor?.isInitialized || !token) return;
    const id = parseInt(draftIdParam, 10);
    if (!id) return;
    setServerDraftId(id);
    serverDraftIdRef.current = id;
    fetch(apiUrl(`/api/posts/draft/${id}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.draft) return;
        const d = data.draft;
        if (d.title) setTitle(d.title);
        if (d.type) setType(normalizePostType(d.type));
        if (d.tags) {
          try { setTagsStr(JSON.parse(d.tags).join(', ')); } catch { setTagsStr(d.tags); }
        }
        if (d.imageUrl) setImageUrl(d.imageUrl);
        let attachments = d.attachments;
        if (typeof attachments === 'string') {
          try { attachments = JSON.parse(attachments); } catch { attachments = []; }
        }
        setPostAttachments(Array.isArray(attachments) ? attachments : []);
        if (d.content) editor.commands.setContent(d.content);
        setDraftRestored(true);
        setHasDraft(false);
        toast({ title: 'Draft loaded - resume editing' });
      })
      .catch(() => toast({ title: 'Could not load draft', variant: 'destructive' }));
  }, [editor, token]);

  useEffect(() => {
    if (editPostId || draftRestored) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.content || d?.title) setHasDraft(true);
      }
    } catch { }
  }, []);

  const restoreDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      if (d.title) setTitle(d.title);
      if (d.type) setType(normalizePostType(d.type));
      if (d.tagsStr) setTagsStr(d.tagsStr);
      if (d.imageUrl) setImageUrl(d.imageUrl);
      if (Array.isArray(d.postAttachments)) setPostAttachments(d.postAttachments);
      if (d.content && editor) editor.commands.setContent(d.content);
      setDraftRestored(true);
      setHasDraft(false);
      toast({ title: t('write.draftRestored') });
    } catch {
      toast({ title: t('write.draftRestoreFailed'), variant: 'destructive' });
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  };

  useEffect(() => {
    if (!editor?.isInitialized || editPostId) return;
    const interval = window.setInterval(() => {
      if (!editor.isInitialized) return;
      const content = editor.getHTML();
      if (!content || content === '<p></p>') return;
      try {
        const draft = JSON.stringify({
          title, type, tagsStr,
          imageUrl: imageUrl?.startsWith('data:') ? '' : imageUrl,
          postAttachments,
          content, savedAt: Date.now(),
        });
        if (draft.length > 200_000) return;
        localStorage.setItem(DRAFT_KEY, draft);
        setLastSavedAt(Date.now());
      } catch { }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [editor, title, type, tagsStr, imageUrl, postAttachments, DRAFT_KEY]);

  const saveDraftSilently = async (): Promise<boolean> => {
    if (!editor?.isInitialized || !token || editPostId) return false;
    if (draftSavePromiseRef.current) {
      const currentSaveSucceeded = await draftSavePromiseRef.current;
      if (!currentSaveSucceeded) return false;
      return saveDraftSilently();
    }

    const draftContent = editor.getHTML();
    if (!draftContent || editor.isEmpty || (!title.trim() && !editor.getText().trim())) return false;

    const body: Record<string, unknown> = {
      title: title || undefined,
      content: draftContent,
      type: type as any,
      tags: tagsStr.split(',').map((tag) => tag.trim()).filter(Boolean),
      imageUrl: imageUrl || undefined,
      attachments: postAttachments,
      isPublished: false,
    };
    if (serverDraftIdRef.current) body.draftId = serverDraftIdRef.current;

    const savePromise = (async () => {
      try {
        const res = await fetch(apiUrl('/api/posts/draft'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(error?.error || 'Draft could not be saved');
        }

        const data = await res.json() as { draftId?: number };
        if (data.draftId && !serverDraftIdRef.current) {
          serverDraftIdRef.current = data.draftId;
          setServerDraftId(data.draftId);
        }
        setLastSavedAt(Date.now());
        setShowSaved(true);
        window.setTimeout(() => setShowSaved(false), 1800);
        return true;
      } catch (error) {
        console.error('[write] draft autosave failed', error);
        reportCaughtError(error, { action: 'autosave_draft' });
        setShowSaved(false);
        toast({
          title: 'Draft could not be saved',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
        return false;
      }
    })();
    draftSavePromiseRef.current = savePromise;
    try {
      return await savePromise;
    } finally {
      if (draftSavePromiseRef.current === savePromise) draftSavePromiseRef.current = null;
    }
  };

  useEffect(() => {
    if (!editor?.isInitialized || !token || editPostId || (!title.trim() && !editor.getText().trim())) return;
    const timer = window.setTimeout(() => {
      void saveDraftSilently();
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [editor, title, content, tagsStr, type, imageUrl, postAttachments, token, serverDraftId]);

  const checkOriginality = async (content: string): Promise<{ ok: boolean; warning: string | null }> => {
    if (!token || content.replace(/<[^>]+>/g, '').trim().length < 100) return { ok: true, warning: null };
    try {
      setOriginalityChecking(true);
      const res = await fetch('/api/originality/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return { ok: true, warning: null };
      const data = (await res.json()) as { similar?: boolean; topMatchScore?: number; message?: string };
      if (data.similar) {
        return {
          ok: false,
          warning:
            data.message ||
            'Your content looks similar to existing posts. Add your own perspective or rewrite for originality.',
        };
      }
      return { ok: true, warning: null };
    } catch {
      return { ok: true, warning: null };
    } finally {
      setOriginalityChecking(false);
    }
  };

  const submitChallenge = async (postId: number) => {
    if (!challengeCtx || !token) return;
    try {
      await fetch(`/api/challenges/${challengeCtx.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId }),
      });
    } catch {
      /* non-fatal */
    }
  };

  const handlePublish = async (isPublished: boolean) => {
    if (!editor?.isInitialized || editor.isEmpty) {
      toast({ title: t('write.emptyContent'), description: t('write.emptyContentDesc'), variant: 'destructive' });
      return;
    }
    if (!user) {
      toast({ title: t('write.notLoggedIn'), variant: 'destructive' });
      return;
    }
    const content = editor.getHTML();
    if (content.length > 50_000) {
      toast({ title: 'Content is too long', description: 'Keep content under 50,000 characters.', variant: 'destructive' });
      return;
    }
    if (!isPublished) {
      const saved = await saveDraftSilently();
      if (saved) toast({ title: t('write.savedAsDraft'), description: t('write.savedAsDraftDesc') });
      return;
    }
    if (isPublished) {
      const { ok, warning } = await checkOriginality(content);
      if (!ok) {
        setOriginalityWarning(warning);
        toast({
          title: t('write.originalityFailed'),
          description: warning || t('write.originalityFailedDesc'),
          variant: 'destructive',
        });
        return;
      }
      setOriginalityWarning(null);
    }
    if (editPostId) {
      const tags = tagsStr.split(',').map(tag => tag.trim()).filter(Boolean);
      if (title.length > 180 || tags.length > 12 || tags.some(tag => tag.length > 40)) {
        toast({ title: 'Check your post details', description: 'Titles can be up to 180 characters and posts can have up to 12 tags of 40 characters each.', variant: 'destructive' });
        return;
      }

      setIsSavingEdit(true);
      try {
        const response = await fetch(apiUrl(`/api/posts/${editPostId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title,
            content,
            excerpt: editor.getText().trim().slice(0, 500),
            ...(imageUrl !== originalImageUrl && imageUrl ? { imageUrl } : {}),
            attachments: postAttachments,
            tags,
          }),
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: string; message?: string } | null;
          throw new Error(response.status === 403
            ? 'You can only edit your own posts.'
            : errorBody?.error || errorBody?.message || 'Could not save changes.');
        }
        await response.json();
        await queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        toast({ title: 'Changes saved', description: 'Your post and edit history have been updated.' });
        setLocation(`/post/${editPostId}`);
      } catch (error) {
        toast({
          title: 'Could not save changes',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSavingEdit(false);
      }
      return;
    }

    const payload: any = {
      title: enableAB ? undefined : (title || undefined),
      titleA: enableAB ? (titleA || undefined) : undefined,
      titleB: enableAB ? (titleB || undefined) : undefined,
      content,
      type: type as any,
      imageUrl: imageUrl || undefined,
      attachments: postAttachments,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      isPublished: enableSchedule ? false : isPublished,
      scheduledAt: enableSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      seriesId: seriesId ? Number(seriesId) : undefined,
      quotedPostId: quoteTargetId || undefined,
    };
    createPost({
      data: payload,
    }, {
      onSuccess: (post) => {
        if (challengeCtx && isPublished) void submitChallenge(post.id);
      },
    } as Parameters<typeof createPost>[1]);
    if (!isPublished) {
      toast({ title: t('write.savedAsDraft'), description: t('write.savedAsDraftDesc') });
    }
  };

  const callAiEndpoint = async (endpoint: string, body: Record<string, string>) => {
    const res = await fetch(`/api/ai/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('AI request failed');
    return res.json();
  };

  const handleAiAssist = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    setAiResult('');
    try {
      const data = await callAiEndpoint('assist', {
        prompt: aiPrompt,
        context: editor?.getText() || '',
        mode: aiMode,
      });
      const suggestion = data.suggestion || '';
      if (suggestion) {
        editor?.chain().focus().insertContent(`\n\n${suggestion}`).run();
        toast({ title: t('write.aiAssistComplete'), description: t('write.aiAssistCompleteDesc') });
      }
      setAiPanel(null);
      setAiPrompt('');
    } catch {
      toast({ title: t('write.aiError'), description: t('write.aiAssistError'), variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiCaption = async () => {
    if (!captionTopic) return;
    setIsAiLoading(true);
    setAiResult('');
    try {
      const data = await callAiEndpoint('caption', { topic: captionTopic, tone: captionTone });
      setAiResult(data.suggestion || '');
    } catch {
      toast({ title: t('write.aiError'), description: t('write.aiCaptionError'), variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiImprove = async () => {
    const textToImprove = improveContent || editor?.getText() || '';
    if (!textToImprove) return;
    setIsAiLoading(true);
    setAiResult('');
    try {
      const data = await callAiEndpoint('improve', { content: textToImprove, focus: improveFocus });
      setAiResult(data.suggestion || '');
    } catch {
      toast({ title: t('write.aiError'), description: t('write.aiImproveError'), variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiIdeas = async () => {
    if (!ideasTheme) return;
    setIsAiLoading(true);
    setAiResult('');
    try {
      const data = await callAiEndpoint('ideas', { theme: ideasTheme, genre: ideasGenre, mood: ideasMood });
      setAiResult(data.suggestion || '');
    } catch {
      toast({ title: t('write.aiError'), description: t('write.aiIdeasError'), variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiTitles = async () => {
    const content = editor?.getText() || '';
    if (!content.trim()) {
      toast({ title: t('write.aiError'), description: 'Write some content first before generating titles.', variant: 'destructive' });
      return;
    }
    setIsAiLoading(true);
    setAiTitleSuggestions([]);
    try {
      const res = await fetch('/api/ai/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content, type }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      setAiTitleSuggestions(Array.isArray(data.titles) ? data.titles : []);
    } catch {
      toast({ title: t('write.aiError'), description: 'Could not generate titles.', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiHashtags = async () => {
    const content = editor?.getText() || '';
    if (!content.trim()) {
      toast({ title: t('write.aiError'), description: 'Write some content first before generating tags.', variant: 'destructive' });
      return;
    }
    setIsAiLoading(true);
    setAiHashtagSuggestions([]);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content, title }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      setAiHashtagSuggestions(Array.isArray(data.tags) ? data.tags : []);
    } catch {
      toast({ title: t('write.aiError'), description: 'Could not generate tags.', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyResultToEditor = () => {
    if (!aiResult) return;
    editor?.chain().focus().insertContent(`\n\n${aiResult}`).run();
    toast({ title: t('write.aiApplied') });
    setAiPanel(null);
    setAiResult('');
  };

  if (!editor) return null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-0 pb-20">
        <BackButton />

        {quotedPost && (
          <div className="mb-5 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Quoting {quotedPost.author?.displayName || 'this post'}</span>
              <button type="button" onClick={() => { setQuotedPost(null); setQuoteTargetId(null); }} className="text-muted-foreground hover:text-foreground" aria-label="Remove quote">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">{quotedPost.excerpt || quotedPost.content}</p>
            {quotedPost.imageUrl && <img src={quotedPost.imageUrl} alt="" className="mt-3 h-24 w-36 rounded-lg object-cover" />}
          </div>
        )}

        {hasDraft && !draftRestored && (
          <div className="mb-4 p-4 rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <Save className="w-4 h-4 inline mr-1" /> {t('write.unsavedDraft')}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={discardDraft} className="rounded-xl">{t('write.discard')}</Button>
              <Button size="sm" onClick={restoreDraft} className="rounded-xl">{t('write.restoreDraft')}</Button>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-serif font-bold">{editPostId ? 'Edit post' : t('write.newPiece')}</h1>
          <div className="flex items-center gap-3">
            {showSaved && <span className="text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">Saved</span>}
            {!editPostId && (
              <Button
                variant="outline"
                onClick={() => handlePublish(false)}
                disabled={isCreating}
                className="rounded-xl"
              >
                <Save className="w-4 h-4 mr-2" /> {t('write.draft')}
              </Button>
            )}
            <Button
              onClick={() => handlePublish(true)}
              disabled={isCreating || isSavingEdit || isLoadingEdit || (!editPostId && enableSchedule && !scheduledAt)}
              className="rounded-xl bg-gradient-to-r from-primary to-violet-500 text-white border-0 shadow-lg"
            >
              {isCreating || isSavingEdit || isLoadingEdit
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : enableSchedule ? <Calendar className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {isLoadingEdit ? 'Loading post...' : isSavingEdit ? 'Saving changes...' : editPostId ? 'Save changes' : enableSchedule ? t('write.schedule') : t('write.publish')}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-3xl shadow-sm overflow-hidden mb-8">

          {/* Metadata */}
          <div className="p-6 bg-muted/30 border-b border-border/60 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Type */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label>{t('write.typeLabel')}</Label>
              {editPostId ? (
                <p className="text-sm capitalize text-muted-foreground">{type.replace(/_/g, ' ')}</p>
              ) : (
              <>
              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_POST_TYPES.map(pt => {
                  const Icon = pt.icon;
                  const isActive = type === pt.value;
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setType(pt.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${isActive ? pt.activeBg : `bg-background border-border/60 hover:${pt.bg}`}`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${isActive ? pt.color : 'text-muted-foreground'}`} />
                      <p className={`font-semibold text-sm ${isActive ? pt.color : 'text-foreground'}`}>{pt.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{pt.desc}</p>
                    </button>
                  );
                })}
              </div>
              {ADVANCED_POST_TYPES.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedTypes(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    {showAdvancedTypes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    More formats
                  </button>
                  {showAdvancedTypes && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ADVANCED_POST_TYPES.map(at => {
                        const Icon = at.icon;
                        const isActive = type === at.value;
                        return (
                          <button
                            key={at.value}
                            type="button"
                            onClick={() => setType(at.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${isActive ? 'bg-primary/10 border-primary text-primary font-semibold' : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                          >
                            <Icon className="w-3.5 h-3.5" /> {at.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              </>
              )}
            </div>

            {/* Title / A-B Testing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('write.titleLabel')} {enableAB ? t('write.abTestSuffix') : t('write.optionalSuffix')}</Label>
                {!editPostId && <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FlaskConical className="w-3 h-3" />
                  <span>{t('write.abTest')}</span>
                  <Switch checked={enableAB} onCheckedChange={setEnableAB} />
                </div>}
              </div>
              {enableAB ? (
                <div className="space-y-2">
                  <Input placeholder={t('write.titleAPlaceholder')} value={titleA} onChange={e => setTitleA(e.target.value)} className="font-serif text-base rounded-xl bg-background" />
                  <Input placeholder={t('write.titleBPlaceholder')} value={titleB} onChange={e => setTitleB(e.target.value)} className="font-serif text-base rounded-xl bg-background" />
                  <p className="text-xs text-muted-foreground">{t('write.abTestHint')}</p>
                </div>
              ) : (
                <Input
                  placeholder={t('write.titlePlaceholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="font-serif text-lg rounded-xl bg-background"
                />
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tags className="w-4 h-4" /> {t('write.tagsLabel')}
              </Label>
              <Input
                placeholder={t('write.tagsInputPlaceholder')}
                value={tagsStr}
                onChange={e => setTagsStr(e.target.value)}
                className="rounded-xl bg-background"
              />
            </div>

            {/* Series */}
            {!editPostId && mySeries.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Add to Series
                </Label>
                <Select value={seriesId} onValueChange={setSeriesId}>
                  <SelectTrigger className="rounded-xl bg-background">
                    <SelectValue placeholder="None (standalone post)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (standalone post)</SelectItem>
                    {mySeries.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Group this post into an ongoing series for readers to follow.</p>
              </div>
            )}

            {/* Cover image */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> {t('write.coverImageLabel')}
              </Label>
              <ImageUploadField value={imageUrl} onChange={setImageUrl} category="post" label={t('write.chooseCoverImage', 'Choose cover image')} />
            </div>
            {/* Attachments */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> {t('write.attachFilesLabel')}
              </Label>
              <AttachmentPicker
                attachments={postAttachments}
                onChange={setPostAttachments}
                max={20}
                label={t('write.addFiles')}
              />
              <p className="text-xs text-muted-foreground">{t('write.attachFilesHint')}</p>
            </div>
            {/* Scheduling */}
            {!editPostId && <div className="space-y-2 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> {t('write.schedulePublishing')}</Label>
                <Switch checked={enableSchedule} onCheckedChange={setEnableSchedule} />
              </div>
              {enableSchedule && (
                <div>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                    className="rounded-xl bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('write.scheduleHint')}</p>
                </div>
              )}
            </div>}
          </div>

          {/* Toolbar */}
          <div className="border-b border-border/60 bg-card p-2 flex flex-wrap items-center gap-1 sticky top-16 z-30 shadow-sm">
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-muted' : ''}>
              <Bold className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-muted' : ''}>
              <Italic className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'bg-muted' : ''}>
              <UnderlineIcon className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}>
              <Heading1 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}>
              <Heading2 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'bg-muted' : ''}>
              <List className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'bg-muted' : ''}>
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'bg-muted' : ''}>
              <Quote className="w-4 h-4" />
            </Button>
            {aiToolsAvailable && <div className="ml-auto flex items-center gap-1 flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('titles'); setAiResult(''); }} className="rounded-full text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <Type className="w-3.5 h-3.5" /> {t('write.aiTitles', 'Titles')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('hashtags'); setAiResult(''); }} className="rounded-full text-xs gap-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30">
                <Hash className="w-3.5 h-3.5" /> {t('write.aiHashtags', 'Tags')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('assist'); setAiResult(''); }} className="rounded-full text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                <Sparkles className="w-3.5 h-3.5" /> {t('write.aiAssist')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('caption'); setAiResult(''); }} className="rounded-full text-xs gap-1.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                <MessageSquare className="w-3.5 h-3.5" /> {t('write.aiCaption')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('improve'); setAiResult(''); setImproveContent(''); }} className="rounded-full text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                <Wand2 className="w-3.5 h-3.5" /> {t('write.aiImprove')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAiPanel('ideas'); setAiResult(''); }} className="rounded-full text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                <Lightbulb className="w-3.5 h-3.5" /> {t('write.aiIdeas')}
              </Button>
            </div>}
          </div>

          {/* Editor */}
          <div className="bg-card cursor-text" onClick={() => editor.commands.focus()}>
            <EditorContent editor={editor} />
            {(isLinkPreviewLoading || linkPreview) && (
              <div className="mx-4 mb-5 overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm">
                {isLinkPreviewLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading link preview...</div>
                ) : linkPreview && (
                  <a href={linkPreview.url} target="_blank" rel="noreferrer" className="group flex min-h-24 items-stretch no-underline">
                    {linkPreview.image && <img src={linkPreview.image} alt="" className="hidden w-28 object-cover sm:block" />}
                    <div className="min-w-0 flex-1 p-4">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">{linkPreview.title}</p>
                      {linkPreview.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{linkPreview.description}</p>}
                      <p className="mt-2 truncate text-[11px] text-muted-foreground">{new URL(linkPreview.url).hostname}</p>
                    </div>
                    <ArrowUpRight className="m-4 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Panel - Writing Assist */}
      <Dialog open={aiToolsAvailable && aiPanel === 'assist'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Sparkles className="w-5 h-5 text-amber-500" /> {t('write.aiAssistTitle')}
            </DialogTitle>
            <DialogDescription>{t('write.aiAssistDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('write.aiModeLabel')}</Label>
              <Select value={aiMode} onValueChange={setAiMode}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">{t('write.aiModeContinue')}</SelectItem>
                  <SelectItem value="improve">{t('write.aiModeImprove')}</SelectItem>
                  <SelectItem value="brainstorm">{t('write.aiModeBrainstorm')}</SelectItem>
                  <SelectItem value="summarize">{t('write.aiModeSummarize')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('write.aiInstructions')}</Label>
              <Input placeholder={t('write.aiInstructionsPlaceholder')} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="rounded-xl" onKeyDown={e => e.key === 'Enter' && handleAiAssist()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.cancel')}</Button>
            <Button onClick={handleAiAssist} disabled={isAiLoading || !aiPrompt} className="rounded-xl bg-amber-500 text-white hover:bg-amber-600">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} {t('write.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel - Caption Generator */}
      <Dialog open={aiToolsAvailable && aiPanel === 'caption'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <MessageSquare className="w-5 h-5 text-violet-500" /> {t('write.captionTitle')}
            </DialogTitle>
            <DialogDescription>{t('write.captionDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('write.captionTopicLabel')}</Label>
              <Input placeholder={t('write.captionTopicPlaceholder')} value={captionTopic} onChange={e => setCaptionTopic(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t('write.captionToneLabel')}</Label>
              <Input placeholder={t('write.captionTonePlaceholder')} value={captionTone} onChange={e => setCaptionTone(e.target.value)} className="rounded-xl" />
            </div>
            {aiResult && (
              <div className="bg-muted/50 rounded-xl p-4 text-sm whitespace-pre-wrap border border-border/50 max-h-48 overflow-y-auto">{aiResult}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.close')}</Button>
            <Button onClick={handleAiCaption} disabled={isAiLoading || !captionTopic} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />} {t('write.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel - Improve Content */}
      <Dialog open={aiToolsAvailable && aiPanel === 'improve'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Wand2 className="w-5 h-5 text-blue-500" /> {t('write.improveTitle')}
            </DialogTitle>
            <DialogDescription>{t('write.improveDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('write.improveFocusLabel')}</Label>
              <Select value={improveFocus} onValueChange={setImproveFocus}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clarity">{t('write.focusClarity')}</SelectItem>
                  <SelectItem value="engagement">{t('write.focusEngagement')}</SelectItem>
                  <SelectItem value="flow">{t('write.focusFlow')}</SelectItem>
                  <SelectItem value="impact">{t('write.focusImpact')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('write.improveContentLabel')}</Label>
              <Textarea placeholder={t('write.improveContentPlaceholder')} value={improveContent} onChange={e => setImproveContent(e.target.value)} className="rounded-xl min-h-[80px]" />
            </div>
            {aiResult && (
              <div className="space-y-2">
                <div className="bg-muted/50 rounded-xl p-4 text-sm whitespace-pre-wrap border border-border/50 max-h-48 overflow-y-auto">{aiResult}</div>
                <Button size="sm" variant="outline" onClick={applyResultToEditor} className="w-full rounded-xl">
                  <ChevronRight className="w-4 h-4 mr-2" /> {t('write.applyToEditor')}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.close')}</Button>
            <Button onClick={handleAiImprove} disabled={isAiLoading} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} {t('write.aiImprove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel - Idea Generator */}
      <Dialog open={aiToolsAvailable && aiPanel === 'ideas'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Lightbulb className="w-5 h-5 text-emerald-500" /> {t('write.ideasTitle')}
            </DialogTitle>
            <DialogDescription>{t('write.ideasDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('write.ideasThemeLabel')}</Label>
              <Input placeholder={t('write.ideasThemePlaceholder')} value={ideasTheme} onChange={e => setIdeasTheme(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('write.ideasGenreLabel')}</Label>
                <Input placeholder={t('write.ideasGenrePlaceholder')} value={ideasGenre} onChange={e => setIdeasGenre(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>{t('write.ideasMoodLabel')}</Label>
                <Input placeholder={t('write.ideasMoodPlaceholder')} value={ideasMood} onChange={e => setIdeasMood(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            {aiResult && (
              <div className="bg-muted/50 rounded-xl p-4 text-sm whitespace-pre-wrap border border-border/50 max-h-56 overflow-y-auto">{aiResult}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.close')}</Button>
            <Button onClick={handleAiIdeas} disabled={isAiLoading || !ideasTheme} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />} {t('write.generateIdeas')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel - Title Suggestions */}
      <Dialog open={aiToolsAvailable && aiPanel === 'titles'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Type className="w-5 h-5 text-rose-500" /> {t('write.aiTitlesTitle', 'Title Suggestions')}
            </DialogTitle>
            <DialogDescription>{t('write.aiTitlesDesc', 'Generate 3 compelling title options based on your content.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {aiTitleSuggestions.length === 0 && !isAiLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('write.aiTitlesHint', 'Write some content first, then generate title suggestions.')}</p>
            )}
            {aiTitleSuggestions.map((t2, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 group">
                <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                <p className="flex-1 text-sm font-medium text-foreground leading-snug">{t2}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg"
                    onClick={() => { setTitle(t2); toast({ title: 'Title applied!' }); setAiPanel(null); }}>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg"
                    onClick={() => { navigator.clipboard.writeText(t2); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1500); }}>
                    {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-blue-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.close')}</Button>
            <Button onClick={handleAiTitles} disabled={isAiLoading} className="rounded-xl bg-rose-500 text-white hover:bg-rose-600">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Type className="w-4 h-4 mr-2" />} {t('write.generateTitles', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel - Hashtag Suggestions */}
      <Dialog open={aiToolsAvailable && aiPanel === 'hashtags'} onOpenChange={(o) => { if (!o) setAiPanel(null); }}>
        <DialogContent className="sm:max-w-lg border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Hash className="w-5 h-5 text-teal-500" /> {t('write.aiHashtagsTitle', 'Tag Suggestions')}
            </DialogTitle>
            <DialogDescription>{t('write.aiHashtagsDesc', 'Auto-generate relevant tags to reach your ideal audience.')}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {aiHashtagSuggestions.length === 0 && !isAiLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('write.aiHashtagsHint', 'Write some content first, then generate tag suggestions.')}</p>
            )}
            {aiHashtagSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {aiHashtagSuggestions.map((tag, i) => (
                  <button key={i} onClick={() => {
                    const current = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
                    if (!current.includes(tag)) { setTagsStr([...current, tag].join(', ')); }
                  }} className="px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-medium border border-teal-200 dark:border-teal-800 hover:bg-teal-200 dark:hover:bg-teal-800/50 transition-colors">
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {aiHashtagSuggestions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">{t('write.aiHashtagsApplyHint', 'Click a tag to add it to your post.')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiPanel(null)} className="rounded-xl">{t('write.close')}</Button>
            <Button onClick={handleAiHashtags} disabled={isAiLoading} className="rounded-xl bg-teal-600 text-white hover:bg-teal-700">
              {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hash className="w-4 h-4 mr-2" />} {t('write.generateTags', 'Generate tags')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-publish Boost CTA */}
      <Dialog open={!!boostCtaPostId} onOpenChange={(open) => { if (!open && boostCtaPostId) { setLocation(`/post/${boostCtaPostId}`); setBoostCtaPostId(null); } }}>
        <DialogContent className="sm:max-w-md border-border/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif">
              <Rocket className="w-5 h-5 text-violet-500" /> {t('write.boostCtaTitle', "Your post is live!")}
            </DialogTitle>
            <DialogDescription>
              {t('write.boostCtaDesc', "Give your post a boost to reach more readers across QuillHive.")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Rocket className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{t('write.boostCtaFeature', "Amplify your reach")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('write.boostCtaFeatureDesc', "Boosted posts appear at the top of feeds and get a prominent badge.")}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setLocation(`/post/${boostCtaPostId!}`); setBoostCtaPostId(null); }} className="rounded-xl">
              {t('write.boostCtaSkip', "View post")}
            </Button>
            <Button
              onClick={() => { setLocation(`/post/${boostCtaPostId!}`); setBoostCtaPostId(null); }}
              className="rounded-xl bg-violet-500 text-white hover:bg-violet-600"
            >
              <Rocket className="w-4 h-4 mr-2" /> {t('write.boostCtaAction', "Boost this post")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
