import * as React from 'react';
import {
  Archive,
  BarChart3,
  BellOff,
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Edit3,
  Flag,
  Link2,
  MessageCircleOff,
  MoreHorizontal,
  Pin,
  PinOff,
  Redo2,
  Send,
  Share2,
  ShieldBan,
  Trash2,
  UserMinus,
  UserPlus,
  XCircle,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PostOptionPost = {
  id: number | string;
  type: 'article' | 'update' | 'portfolio' | 'job' | 'gig' | 'group_post';
  status: 'active' | 'filled' | 'closed' | 'completed' | 'archived';
  authorId: number | string;
};

export type PostOptionAction =
  | 'pin'
  | 'edit'
  | 'analytics'
  | 'proposals'
  | 'boost'
  | 'toggle-comments'
  | 'archive'
  | 'filled'
  | 'completed'
  | 'closed'
  | 'unavailable'
  | 'reopen'
  | 'delete-permanently'
  | 'save'
  | 'add-to-library'
  | 'copy-link'
  | 'embed'
  | 'share-whatsapp'
  | 'share-twitter'
  | 'follow'
  | 'not-interested'
  | 'mute'
  | 'block'
  | 'report'
  | 'apply'
  | 'withdraw-proposal'
  | 'save-job';

export type PostOptionsMenuProps = {
  post: PostOptionPost;
  currentUserId?: number | string | null;
  isOwner: boolean;
  isPinned?: boolean;
  commentsEnabled?: boolean;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  hasApplied?: boolean;
  onAction?: (action: PostOptionAction, post: PostOptionPost) => void | Promise<void>;
  onDeletePermanently?: () => void | Promise<void>;
  className?: string;
};

type MenuItem = {
  label: string;
  action: PostOptionAction;
  icon: React.ElementType;
  destructive?: boolean;
};

const reportReasons = [
  'Spam',
  'Plagiarism',
  'Harassment',
  'Scam/Fake Job',
  'Inappropriate Content',
] as const;

function ItemIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

export function PostOptionsMenu({
  post,
  currentUserId,
  isOwner,
  isPinned = false,
  commentsEnabled = true,
  isSaved = false,
  isFollowingAuthor = false,
  hasApplied = false,
  onAction,
  onDeletePermanently,
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
      await onAction?.(action, post);
    } catch {
      toast({ title: 'Action could not be completed', variant: 'destructive' });
    }
  }, [onAction, post, toast]);

  const confirmAction = async () => {
    if (!confirmation) return;
    setIsWorking(true);
    try {
      if (confirmation === 'delete') {
        await onDeletePermanently?.();
        await onAction?.('delete-permanently', post);
      } else {
        await onAction?.('archive', post);
      }
      setConfirmation(null);
      setOpen(false);
    } catch {
      toast({ title: 'Action could not be completed', variant: 'destructive' });
    } finally {
      setIsWorking(false);
    }
  };

  const ownerSections: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: 'Management',
      items: [
        { label: isPinned ? 'Unpin from Profile' : 'Pin to Profile', action: 'pin', icon: isPinned ? PinOff : Pin },
        { label: 'Edit Post', action: 'edit', icon: Edit3 },
        { label: post.type === 'job' ? 'View Proposals' : 'View Analytics', action: post.type === 'job' ? 'proposals' : 'analytics', icon: post.type === 'job' ? BriefcaseBusiness : BarChart3 },
        ...(post.type !== 'job' ? [{ label: 'Boost Post', action: 'boost' as const, icon: CircleDollarSign }] : []),
      ],
    },
    ...(post.type !== 'job' ? [{
      label: 'Distribution',
      items: [
        { label: 'Add to Library', action: 'add-to-library' as const, icon: BookOpen },
        { label: 'Copy Link', action: 'copy-link' as const, icon: Link2 },
        { label: 'Embed Post', action: 'embed' as const, icon: Code2 },
        { label: 'Share via WhatsApp', action: 'share-whatsapp' as const, icon: Send },
        { label: 'Share via Twitter', action: 'share-twitter' as const, icon: Share2 },
      ],
    }] : []),
    {
      label: 'Visibility',
      items: [
        { label: commentsEnabled ? 'Turn Off Comments' : 'Turn On Comments', action: 'toggle-comments', icon: MessageCircleOff },
        { label: 'Archive Post', action: 'archive' as const, icon: Archive },
        ...(post.type === 'job' ? [
          ...(post.status === 'active' ? [
            { label: 'Mark as Filled', action: 'filled' as const, icon: CheckCircle2 },
            { label: 'Mark as Completed', action: 'completed' as const, icon: CheckCircle2 },
            { label: 'Close Opportunity', action: 'closed' as const, icon: XCircle },
            { label: 'Mark as No Longer Available', action: 'unavailable' as const, icon: Archive },
          ] : [{ label: 'Reopen Opportunity', action: 'reopen' as const, icon: Redo2 }]),
        ] : []),
      ],
    },
  ];

  const viewerSections: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: 'Actions',
      items: [
        { label: isSaved ? 'Unsave Post' : 'Save Post', action: 'save', icon: Bookmark },
        ...(post.type !== 'job' ? [{ label: 'Add to Library', action: 'add-to-library' as const, icon: BookOpen }] : []),
        { label: 'Copy Link', action: 'copy-link', icon: Link2 },
        { label: 'Embed Post', action: 'embed', icon: Code2 },
        { label: 'Share via WhatsApp', action: 'share-whatsapp', icon: Send },
        { label: 'Share via Twitter', action: 'share-twitter', icon: Share2 },
      ],
    },
    {
      label: 'Preferences',
      items: [
        { label: isFollowingAuthor ? 'Unfollow Author' : 'Follow Author', action: 'follow', icon: isFollowingAuthor ? UserMinus : UserPlus },
        { label: 'Not Interested', action: 'not-interested', icon: BellOff },
        { label: 'Mute Author', action: 'mute', icon: BellOff },
        { label: 'Block Author', action: 'block', icon: ShieldBan, destructive: true },
      ],
    },
    {
      label: 'Support',
      items: [],
    },
  ];

  if (!isOwner && post.type === 'job') {
    viewerSections.splice(1, 0, {
      label: 'Workspace',
      items: [
        { label: hasApplied ? 'Withdraw Proposal' : 'Apply for this Job', action: hasApplied ? 'withdraw-proposal' : 'apply', icon: hasApplied ? XCircle : BriefcaseBusiness },
        { label: 'Save Job', action: 'save-job', icon: Bookmark },
        { label: 'Report Job', action: 'report', icon: Flag, destructive: true },
      ],
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
        if (closeAfter) setOpen(false);
        void runAction(item.action);
      }}
    >
      <ItemIcon icon={item.icon} />
      <span>{item.label}</span>
    </button>
  );

  const renderReportSubmenu = (mobile = false) => mobile ? (
    <div className="space-y-1">
      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Post</p>
      {reportReasons.map((reason) => (
        <button key={reason} type="button" className={itemClass(true)} onClick={() => { setOpen(false); void runAction('report'); }}>
          <Flag className="h-4 w-4 shrink-0" aria-hidden="true" />{reason}
        </button>
      ))}
    </div>
  ) : (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive focus:bg-destructive/10">
        <Flag className="h-4 w-4" /> Report Post
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52 rounded-xl p-1">
        {reportReasons.map((reason) => <DropdownMenuItem key={reason} onSelect={() => void runAction('report')} className="cursor-pointer gap-2 rounded-lg py-2.5">{reason}</DropdownMenuItem>)}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );

  const renderSections = (mobile = false) => {
    const sections = isOwner ? ownerSections : viewerSections;
    return sections.map((section, index) => (
      <React.Fragment key={section.label}>
        {index > 0 && (mobile ? <div className="my-3 h-px bg-border" /> : <DropdownMenuSeparator />)}
        {mobile ? <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p> : <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs uppercase tracking-wider text-muted-foreground">{section.label}</DropdownMenuLabel>}
        {section.items.map((item) => mobile ? renderItem(item) : <DropdownMenuItem key={`${item.action}-${item.label}`} onSelect={() => { setOpen(false); if (item.action === 'archive') setConfirmation('archive'); else void runAction(item.action); }} className={`${itemClass(item.destructive)} cursor-pointer`}>{React.createElement(item.icon, { className: 'h-4 w-4 shrink-0', 'aria-hidden': true })}<span>{item.label}</span></DropdownMenuItem>)}
        {!isOwner && section.label === 'Support' && !mobile && renderReportSubmenu()}
        {!isOwner && section.label === 'Support' && mobile && renderReportSubmenu(true)}
      </React.Fragment>
    ));
  };

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
            <div className="overflow-y-auto pb-2">{renderSections(true)}</div>
            <DrawerFooter className="px-0 pt-2"><DrawerClose asChild><Button variant="outline" className="w-full rounded-xl">Cancel</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">{renderSections()}</DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmation !== null} onOpenChange={(value) => !value && setConfirmation(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmation === 'archive' ? 'Archive Post' : 'Delete Permanently'}</DialogTitle>
            <DialogDescription>
              {confirmation === 'archive'
                ? 'This will hide the post from public views. You can restore it later.'
                : 'This will permanently delete the post and its associated content. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {confirmation === 'archive' && <Button variant="ghost" className="mr-auto rounded-xl text-destructive" onClick={() => setConfirmation('delete')} disabled={isWorking}><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</Button>}
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmation(null)} disabled={isWorking}>Cancel</Button>
            <Button variant={confirmation === 'delete' ? 'destructive' : 'default'} className="rounded-xl" onClick={() => void confirmAction()} disabled={isWorking}>{isWorking ? 'Working...' : confirmation === 'archive' ? 'Archive Post' : 'Delete Permanently'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}