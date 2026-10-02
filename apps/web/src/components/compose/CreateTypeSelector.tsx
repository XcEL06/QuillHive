import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { FileText, Zap, Film, BarChart2, Link2, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFeature } from '@/lib/features';
import { useAuthStore } from '@/store/auth';

interface CreateTypeSelectorProps {
  open: boolean;
  onClose: () => void;
}

interface CreateOption {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  lightBg: string;
  border: string;
}

function OptionCard({ opt, onClose }: { opt: CreateOption; onClose: () => void }) {
  const [, navigate] = useLocation();
  const Icon = opt.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { onClose(); navigate(opt.href); }}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${opt.border} ${opt.lightBg} hover:shadow-sm transition-all text-left`}
    >
      <div className={`w-11 h-11 rounded-xl ${opt.color} flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground text-sm">{opt.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{opt.description}</p>
      </div>
    </motion.button>
  );
}

function SelectorContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const motionEnabled = useFeature("motion_enabled");
  const pollsEnabled = useFeature("polls_enabled");
  const chainsEnabled = useFeature("chains_enabled");
  const canAccessStudio = motionEnabled && ["admin", "super_admin"].includes((user as any)?.role ?? "");

  const CREATE_OPTIONS = [
    {
      href: '/write',
      icon: FileText,
      label: 'Post',
      description: 'Share your thoughts, work, or story',
      color: 'bg-violet-500',
      lightBg: 'bg-violet-50 dark:bg-violet-950/40',
      border: 'border-violet-200 dark:border-violet-800',
    },
    {
      href: '/sparks/new',
      icon: Zap,
      label: 'Spark',
      description: 'A quick idea or update. 280 chars max.',
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
    },
    ...(canAccessStudio ? [{
      href: '/motion/upload',
      icon: Film,
      label: 'Motion',
      description: 'Upload and share a video',
      color: 'bg-pink-500',
      lightBg: 'bg-pink-50 dark:bg-pink-950/40',
      border: 'border-pink-200 dark:border-pink-800',
    }] : []),
    ...(pollsEnabled ? [{
      href: '/polls/new',
      icon: BarChart2,
      label: 'Poll',
      description: 'Ask your audience a question',
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800',
    }] : []),
    ...(chainsEnabled ? [{
      href: '/chains/new',
      icon: Link2,
      label: 'Chain',
      description: 'Start a collaborative thread',
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
    }] : []),
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-foreground">What do you want to create?</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      {CREATE_OPTIONS.map((opt) => (
        <OptionCard key={opt.href} opt={opt} onClose={onClose} />
      ))}
    </div>
  );
}

export function CreateTypeSelector({ open, onClose }: CreateTypeSelectorProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8 px-0">
          <SelectorContent onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">
        <SelectorContent onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
