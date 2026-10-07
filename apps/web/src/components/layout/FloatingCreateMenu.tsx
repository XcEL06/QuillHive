import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Plus, X, Newspaper, Zap, BarChart3, Film } from 'lucide-react';

const CREATE_OPTIONS = [
  { href: '/write', icon: Newspaper, label: 'Article', color: 'bg-violet-500', desc: 'Essays, deep dives & proof of work' },
  { href: '/write?type=spark', icon: Zap, label: 'Spark', color: 'bg-amber-500', desc: 'Quick thought or work update' },
  { href: '/write?type=poll', icon: BarChart3, label: 'Poll', color: 'bg-blue-500', desc: 'Ask your audience' },
  { href: '/motion/upload', icon: Film, label: 'Motion', color: 'bg-pink-500', desc: 'Upload a video' },
];

export function FloatingCreateMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-[4.5rem] right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-2 items-end mb-2"
          >
            {CREATE_OPTIONS.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <motion.div
                  key={opt.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link href={opt.href} onClick={() => setOpen(false)}>
                    <div className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-3.5 py-2.5 shadow-lg hover:shadow-xl transition-all">
                      <div className="flex flex-col items-end min-w-0">
                        <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                      </div>
                      <div className={`w-9 h-9 rounded-xl ${opt.color} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.92 }}
        className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-destructive/90 shadow-destructive/30'
            : 'bg-primary shadow-primary/40 -translate-y-1'
        }`}
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
        </motion.div>
      </motion.button>
    </div>
  );
}
