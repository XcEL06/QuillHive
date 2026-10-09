import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useGetPosts, useCreatePost, useLikePost } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ImageUploadField } from '@/components/media/ImageUploadField';
import { Timestamp } from '@/lib/postTimestamp';
import {
  Upload, Heart, ExternalLink, Image as ImageIcon, X, Loader2, ImageOff, Filter
} from 'lucide-react';
import type { Post } from '@workspace/api-client-react';

export default function Gallery() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>('artwork');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewPost, setViewPost] = useState<Post | null>(null);

  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', externalLink: '' });

  const { data, isLoading } = useGetPosts({ type: typeFilter as any, limit: 50 });

  const { mutate: createPost, isPending: isUploading } = useCreatePost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        toast({ title: 'Uploaded!', description: 'Your artwork is now in the gallery.' });
        setUploadOpen(false);
        setForm({ title: '', description: '', imageUrl: '', externalLink: '' });
      },
      onError: () => toast({ title: 'Upload failed', variant: 'destructive' })
    }
  });

  const { mutate: toggleLike } = useLikePost({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/posts'] }) }
  });

  const handleUpload = () => {
    if (!form.imageUrl) {
      toast({ title: 'Image required', variant: 'destructive' });
      return;
    }
    createPost({
      data: {
        title: form.title || null,
        content: form.description || '<p>Artwork</p>',
        excerpt: form.description || null,
        type: typeFilter as any,
        imageUrl: form.imageUrl,
        externalUrl: form.externalLink.trim() || null,
        tags: ['gallery'],
        isPublished: true,
      }
    });
  };

  const galleryPosts = Array.isArray(data?.posts) ? data.posts : [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-0 py-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold">Gallery</h1>
            <p className="text-muted-foreground mt-1">Artwork, photos, and visual stories from the community</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="rounded-xl bg-primary text-primary-foreground gap-2">
            <Upload className="w-4 h-4" /> Upload
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {['artwork', 'story', 'poem', 'novel', 'post'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all shrink-0 ${typeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border/60 text-muted-foreground hover:border-primary/40'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : galleryPosts.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 rounded-3xl border border-dashed border-border">
            <ImageOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-xl font-serif font-medium mb-2">Gallery is empty</h3>
            <p className="text-muted-foreground mb-6">Be the first to upload artwork to the community gallery.</p>
            <Button onClick={() => setUploadOpen(true)} className="rounded-xl">
              <Upload className="w-4 h-4 mr-2" /> Upload Artwork
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {galleryPosts.map(post => (
              <button
                key={post.id}
                onClick={() => setViewPost(post)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border/40 hover:border-primary/40 transition-all hover:shadow-lg"
              >
                {post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium truncate">{post.title || 'Untitled'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="w-5 h-5 border border-white/30">
                        <AvatarImage src={post.author.avatarUrl || ''} />
                        <AvatarFallback className="text-[8px]">{post.author.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-white/80 text-xs">{post.author.displayName}</span>
                      <span className="ml-auto text-white/80 text-xs flex items-center gap-1">
                        <Heart className="w-3 h-3" />{post.likesCount}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Upload to Gallery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImageUploadField value={form.imageUrl} onChange={imageUrl => setForm(f => ({ ...f, imageUrl }))} category="gallery" label="Choose artwork image" previewClassName="aspect-video" />
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Name your piece" className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Tell the story behind this piece..." className="mt-1.5 rounded-xl resize-none" rows={3} />
            </div>
            <div>
              <Label>External Link</Label>
              <Input value={form.externalLink} onChange={e => setForm(f => ({ ...f, externalLink: e.target.value }))}
                placeholder="Link to full project, portfolio, etc." className="mt-1.5 rounded-xl" />
            </div>
            <Button onClick={handleUpload} disabled={isUploading} className="w-full rounded-xl">
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload to Gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Post Dialog */}
      {viewPost && (
        <Dialog open={!!viewPost} onOpenChange={() => setViewPost(null)}>
          <DialogContent className="sm:max-w-3xl rounded-3xl border-border/50 p-0 overflow-hidden">
            <div className="flex flex-col md:flex-row max-h-[85vh]">
              <div className="flex-1 bg-black/90 flex items-center justify-center min-h-[300px] md:min-h-0">
                {viewPost.imageUrl ? (
                  <img src={viewPost.imageUrl} alt={viewPost.title || ''} className="max-w-full max-h-full object-contain" />
                ) : (
                  <ImageIcon className="w-16 h-16 text-white/20" />
                )}
              </div>
              <div className="md:w-80 shrink-0 flex flex-col">
                <div className="p-5 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={viewPost.author.avatarUrl || ''} />
                      <AvatarFallback>{viewPost.author.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{viewPost.author.displayName}</p>
                      <p className="text-xs text-muted-foreground"><Timestamp value={viewPost.createdAt} /></p>
                    </div>
                  </div>
                  <button onClick={() => setViewPost(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {viewPost.title && <h2 className="text-xl font-serif font-bold">{viewPost.title}</h2>}
                  {viewPost.excerpt && <p className="text-muted-foreground text-sm">{viewPost.excerpt}</p>}
                  {viewPost.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {viewPost.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-border/50 flex items-center gap-4">
                  <button
                    onClick={() => toggleLike({ id: viewPost.id })}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${viewPost.isLiked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'}`}
                  >
                    <Heart className={`w-5 h-5 ${viewPost.isLiked ? 'fill-current' : ''}`} />
                    {viewPost.likesCount}
                  </button>
                  {viewPost.externalUrl && (
                    <a href={viewPost.externalUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <ExternalLink className="w-4 h-4" /> View Project
                    </a>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
