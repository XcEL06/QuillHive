import * as React from 'react';
import type { ComponentType } from 'react';
import {
  Archive,
  BellOff,
  Bookmark,
  BookOpen,
  CircleDollarSign,
  Code2,
  Edit3,
  Flag,
  Link2,
  MoreHorizontal,
  Redo2,
  Send,
  Share2,
  ShieldBan,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PostOptionPost = {
  id: number | string;
  type: 'article' | 'update' | 'portfolio' | 'job' | 'gig' | 'group_post';
  status: 'active' | 'filled' | 'closed' | 'completed' | 'archived';
  authorId: number | string;
  isArchived?: boolean;
  archiveType?: string;
};

export type PostOptionAction =
  | 'edit'
  | 'boost'
  | 'archive'
  | 'restore'
  | 'delete'
  | 'save'
  | 'add-to-library'
  | 'copy-link'
  | 'embed'
  | 'share-whatsapp'
  | 'share-twitter'
  | 'follow'
  | 'mute'
  | 'block'
  | 'report';

export type PostOptionsMenuProps = {
  post: PostOptionPost;
  isOwner: boolean;
  canRestore?: boolean;
  sharingEnabled?: boolean;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  hideBoost?: boolean;
  onAction: (action: PostOptionAction, post: PostOptionPost) => void | Promise<void>;
  onDeletePermanently: () => void | Promise<void>;
  extraActions?: Array<{ label: string; icon: ComponentType<{ className?: string }>; onSelect: () => void }>;
  className?: string;
};

type MenuItem = {
  label: string;
  action: PostOptionAction;
  icon: React.ElementType;
  destructive?: boolean;
};

function ItemIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

export function PostOptionsMenu({
  post,
  isOwner,
  canRestore = false,
  sharingEnabled = true,
  isSaved = false,
  isFollowingAuthor = false,
  hideBoost = false,
  onAction,
  onDeletePermanently,
  extraActions = [],
  className,
}: PostOptionsMenuProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<'archive' | 'delete' | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

  const runAction = React.useCallback(async (action: PostOptionAction) => {
    setOpen(false);
    try {
      await onAction(action, post);
    } catch (error) {
      toast({
        title: 'Action could not be completed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [onAction, post, toast]);

  const confirmAction = async () => {
    if (!confirmation) return;
    setIsWorking(true);
    try {
      if (confirmation === 'delete') {
        await onDeletePermanently();
      } else {
        await onAction('archive', post);
      }
      setConfirmation(null);
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Action could not be completed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const ownerSections: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: 'Management',
      items: [
        { label: 'Edit Post', action: 'edit', icon: Edit3 },
        ...(post.type !== 'job' && !hideBoost ? [{ label: 'Boost Post', action: 'boost' as const, icon: CircleDollarSign }] : []),
      ],
    },
    ...(post.type !== 'job' ? [{
      label: 'Distribution',
      items: [
        { label: 'Add to Library', action: 'add-to-library' as const, icon: BookOpen },
        ...(sharingEnabled ? [
          { label: 'Copy Link', action: 'copy-link' as const, icon: Link2 },
          { label: 'Embed Post', action: 'embed' as const, icon: Code2 },
          { label: 'Share via WhatsApp', action: 'share-whatsapp' as const, icon: Send },
          { label: 'Share via Twitter', action: 'share-twitter' as const, icon: Share2 },
        ] : []),
      ],
    }] : []),
    {
      label: 'Visibility',
      items: [
        ...(post.type !== 'group_post'
          ? post.isArchived
            ? canRestore ? [{ label: 'Restore Post', action: 'restore' as const, icon: Redo2 }] : []
            : [{ label: 'Archive Post', action: 'archive' as const, icon: Archive }]
          : []),
        { label: 'Delete Post', action: 'delete' as const, icon: Trash2, destructive: true },
      ],
    },
  ];

  const viewerSections: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: 'Actions',
      items: [
        { label: isSaved ? 'Unsave Post' : 'Save Post', action: 'save', icon: Bookmark },
        ...(post.type !== 'job' ? [{ label: 'Add to Library', action: 'add-to-library' as const, icon: BookOpen }] : []),
        ...(sharingEnabled ? [
          { label: 'Copy Link', action: 'copy-link' as const, icon: Link2 },
          { label: 'Embed Post', action: 'embed' as const, icon: Code2 },
          { label: 'Share via WhatsApp', action: 'share-whatsapp' as const, icon: Send },
          { label: 'Share via Twitter', action: 'share-twitter' as const, icon: Share2 },
        ] : []),
      ],
    },
    {
      label: 'Preferences',
      items: [
        { label: isFollowingAuthor ? 'Unfollow Author' : 'Follow Author', action: 'follow', icon: isFollowingAuthor ? UserMinus : UserPlus },
        { label: 'Mute Author', action: 'mute', icon: BellOff },
        { label: 'Block Author', action: 'block', icon: ShieldBan, destructive: true },
      ],
    },
    {
      label: 'Support',
      items: [],
    },
  ];

  if (canRestore && post.isArchived) {
    viewerSections.unshift({
      label: 'Archived post',
      items: [{ label: 'Restore Post', action: 'restore', icon: Redo2 }],
    });
  }

  const itemClass = (destructive?: boolean) => `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${destructive ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10' : 'text-foreground hover:bg-accent focus:bg-accent'}`;

  const renderItem = (item: MenuItem, closeAfter = true) => (
    <button
      key={`${item.action}-${item.label}`}
      type="button"
      className={itemClass(item.destructive)}
      onClick={() => {
        if (item.action === 'archive') {
          setOpen(false);
          setConfirmation('archive');
          return;
        }
        if (item.action === 'delete') {
          setOpen(false);
          setConfirmation('delete');
          return;
        }
        if (closeAfter) setOpen(false);
        void runAction(item.action);
      }}
    >
      <ItemIcon icon={item.icon} />
      <span>{item.label}</span>
    </button>
  );

  const renderReportAction = (mobile = false) => mobile
    ? <button type="button" className={itemClass(true)} onClick={() => { setOpen(false); void runAction('report'); }}><Flag className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Report Post</span></button>
    : <DropdownMenuItem onSelect={() => { setOpen(false); void runAction('report'); }} className={`${itemClass(true)} cursor-pointer`}><Flag className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Report Post</span></DropdownMenuItem>;

  const renderSections = (mobile = false) => {
    const sections = isOwner ? ownerSections : viewerSections;
    return sections.map((section, index) => (
      <React.Fragment key={section.label}>
        {index > 0 && (mobile ? <div className="my-3 h-px bg-border" /> : <DropdownMenuSeparator />)}
        {mobile ? <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p> : <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs uppercase tracking-wider text-muted-foreground">{section.label}</DropdownMenuLabel>}
        {section.items.map((item) => mobile ? renderItem(item) : <DropdownMenuItem key={`${item.action}-${item.label}`} onSelect={() => { setOpen(false); if (item.action === 'archive') setConfirmation('archive'); else if (item.action === 'delete') setConfirmation('delete'); else void runAction(item.action); }} className={`${itemClass(item.destructive)} cursor-pointer`}>{React.createElement(item.icon, { className: 'h-4 w-4 shrink-0', 'aria-hidden': true })}<span>{item.label}</span></DropdownMenuItem>)}
        {!isOwner && section.label === 'Support' && renderReportAction(mobile)}
      </React.Fragment>
    ));
  };

  const renderExtraActions = (mobile = false) => extraActions.length > 0 ? (
    <>
      {mobile ? <div className="my-3 h-px bg-border" /> : <DropdownMenuSeparator />}
      {mobile ? <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group</p> : <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs uppercase tracking-wider text-muted-foreground">Group</DropdownMenuLabel>}
      {extraActions.map(({ label, icon: Icon, onSelect }) => mobile
        ? <button key={label} type="button" className={itemClass()} onClick={() => { setOpen(false); onSelect(); }}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span></button>
        : <DropdownMenuItem key={label} onSelect={() => { setOpen(false); onSelect(); }} className={`${itemClass()} cursor-pointer`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span></DropdownMenuItem>)}
    </>
  ) : null;

  const trigger = <Button variant="ghost" size="icon" className={`h-8 w-8 text-muted-foreground ${className ?? ''}`} aria-label="Open post options"><MoreHorizontal className="h-4 w-4" /></Button>;

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="max-h-[88vh] rounded-t-3xl px-4 pb-4">
            <DrawerHeader className="px-3 pb-2 text-left">
              <DrawerTitle>Post Options</DrawerTitle>
              <DrawerDescription>Choose an action for this {post.type.replace('_', ' ')}.</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto pb-2">{renderSections(true)}{renderExtraActions(true)}</div>
            <DrawerFooter className="px-0 pt-2"><DrawerClose asChild><Button variant="outline" className="w-full rounded-xl">Cancel</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">{renderSections()}{renderExtraActions()}</DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmation !== null} onOpenChange={(value) => !value && setConfirmation(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmation === 'archive' ? 'Archive Post' : 'Delete Post'}</DialogTitle>
            <DialogDescription>
              {confirmation === 'archive'
                ? 'This will hide the post from public views. You can restore it later.'
                : 'This will remove the post from public views and your feed.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {confirmation === 'archive' && <Button variant="ghost" className="mr-auto rounded-xl text-destructive" onClick={() => setConfirmation('delete')} disabled={isWorking}><Trash2 className="mr-2 h-4 w-4" /> Delete Post</Button>}
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmation(null)} disabled={isWorking}>Cancel</Button>
            <Button variant={confirmation === 'delete' ? 'destructive' : 'default'} className="rounded-xl" onClick={() => void confirmAction()} disabled={isWorking}>{isWorking ? 'Working...' : confirmation === 'archive' ? 'Archive Post' : 'Delete Post'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}