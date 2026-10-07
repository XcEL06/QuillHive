import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { BackButton } from '@/components/ui/BackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { getStoredToken } from '@/lib/api';
import { BookMarked, Plus, Trash2, Loader2, FolderOpen } from 'lucide-react';

type Collection = {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  postCount?: number;
  posts?: Array<{ id: number; title: string }>;
};

export default function Collections() {
  const { toast } = useToast();
  const t = useT();
  const token = getStoredToken();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collectionRoute, collectionRouteParams] = useRoute('/collections/:id');
  const [detail, setDetail] = useState<Collection | null>(null);
  const [detailError, setDetailError] = useState('');
  const [listError, setListError] = useState('');

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchCollections = async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await fetch('/api/collections', { headers: authHeaders });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setCollections(await res.json());
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Request failed');
      toast({
        title: 'Could not load collections',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!collectionRoute || !collectionRouteParams?.id) {
      if (!collectionRoute) fetchCollections();
      return;
    }
    let cancelled = false;
    setDetailError('');
    setDetail(null);
    (async () => {
      let res = await fetch(`/api/collections/public/${collectionRouteParams.id}`);
      if (res.status === 404 && token) {
        res = await fetch(`/api/collections/${collectionRouteParams.id}`, { headers: authHeaders });
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const collection = await res.json();
      if (!cancelled) setDetail(collection);
    })().catch(error => {
      if (!cancelled) setDetailError(error instanceof Error ? error.message : 'Request failed');
    });
    return () => { cancelled = true; };
  }, [collectionRoute, collectionRouteParams?.id, token]);

  const handleCreate = async () => {
    if (!name.trim()) { toast({ title: t('collections.name', 'Name') + ' is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name, description, isPublic }),
      });
      if (res.ok) {
        const c = await res.json();
        setCollections(prev => [c, ...prev]);
        setShowCreate(false);
        setName(''); setDescription(''); setIsPublic(false);
        toast({ title: t('collections.title', 'Collection') + ' created!' });
      } else {
        const message = await res.text();
        throw new Error(message || `Request failed (${res.status})`);
      }
    } catch (error) {
      toast({
        title: 'Error creating collection',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setCollections(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Collection deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete', description: error instanceof Error ? error.message : 'Request failed', variant: 'destructive' });
    }
  };

  const handleVisibilityChange = async (collection: Collection) => {
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ isPublic: !collection.isPublic }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const updated = await res.json();
      setCollections(current => current.map(item => item.id === updated.id ? updated : item));
      toast({ title: updated.isPublic ? 'Collection is now public' : 'Collection is now private' });
    } catch (error) {
      toast({
        title: 'Could not update collection visibility',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  if (collectionRoute) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 md:px-0 pb-20 pt-4 space-y-6">
          <BackButton />
          {detailError ? (
            <p role="alert" className="text-destructive">{detailError}</p>
          ) : detail ? (
            <>
              <div>
                <h1 className="text-3xl font-serif font-bold">{detail.name}</h1>
                {detail.description && <p className="text-muted-foreground mt-2">{detail.description}</p>}
              </div>
              <div className="space-y-3">
                {detail.posts?.map(post => (
                  <Link key={post.id} href={`/post/${post.id}`}>
                    <Card className="rounded-xl hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 font-medium">{post.title || 'Untitled post'}</CardContent>
                    </Card>
                  </Link>
                ))}
                {!detail.posts?.length && <p className="text-muted-foreground">This collection has no posts yet.</p>}
              </div>
            </>
          ) : <div className="h-28 rounded-2xl bg-muted animate-pulse" />}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-20 space-y-6">
        <div className="pt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
              <BookMarked className="w-7 h-7 text-primary" />
              {t('collections.title', 'Collections')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t('collections.subtitle', 'Curate reading lists and save posts for later')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> {t('collections.new', 'New Collection')}
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        )}

        {!loading && listError && <p role="alert" className="text-destructive">{listError}</p>}
        {!loading && !listError && collections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{t('collections.empty', 'No collections yet')}</p>
            <p className="text-sm">{t('collections.emptyDesc', 'Create a collection to save and organize posts')}</p>
            <Button className="mt-4 rounded-xl" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('collections.createFirst', 'Create your first collection')}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {collections.map(col => (
            <Card key={col.id} className="rounded-2xl border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base truncate">{col.name}</h3>
                    <Link href={`/collections/${col.id}`} className="text-xs text-primary hover:underline">Open</Link>
                    <span className="text-xs text-muted-foreground">
                      {col.isPublic ? t('collections.public', 'Public') : t('collections.private', 'Private')}
                    </span>
                    {col.postCount !== undefined && (
                      <span className="text-xs text-muted-foreground">{col.postCount} {t('collections.posts', 'posts')}</span>
                    )}
                  </div>
                  {col.description && <p className="text-sm text-muted-foreground line-clamp-2">{col.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{new Date(col.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleVisibilityChange(col)}>
                    Make {col.isPublic ? 'private' : 'public'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(col.id)}
                    className="text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${col.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{t('collections.new', 'New Collection')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('collections.name', 'Name')}</Label>
                <Input
                  placeholder={t('collections.namePlaceholder', 'e.g. Must-Read Sci-Fi')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('collections.description', 'Description')}</Label>
                <Textarea
                  placeholder={t('collections.descriptionPlaceholder', 'What is this collection about?')}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded" />
                <Label htmlFor="isPublic" className="font-normal cursor-pointer">
                  {t('collections.makePublic', 'Make this collection public')}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} className="rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('collections.create', 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
