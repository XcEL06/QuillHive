import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link2, Users, Eye, CheckCircle2, Clock } from 'lucide-react';
import { Timestamp } from '@/lib/postTimestamp';

export interface ChainSummary {
  id: number;
  title: string;
  description?: string | null;
  prompt?: string | null;
  category?: string | null;
  maxEntries?: number | null;
  isComplete: boolean;
  totalViews: number;
  createdAt: string;
  entryCount: number;
  creatorName?: string | null;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
}

interface ChainCardProps {
  chain: ChainSummary;
}

const CATEGORY_COLORS: Record<string, string> = {
  fiction: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  poetry: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  essay: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  art: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  humor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export function ChainCard({ chain }: ChainCardProps) {
  const progress = chain.maxEntries ? Math.round((chain.entryCount / chain.maxEntries) * 100) : null;
  const categoryColor = chain.category ? (CATEGORY_COLORS[chain.category.toLowerCase()] ?? 'bg-muted text-muted-foreground') : '';

  return (
    <Link href={`/chains/${chain.id}`}>
      <div className="group bg-card border border-border/60 rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                {chain.title}
              </h3>
              {chain.isComplete && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              )}
              {chain.category && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor}`}>
                  {chain.category}
                </span>
              )}
            </div>

            {chain.prompt && (
              <p className="text-xs text-muted-foreground italic line-clamp-2 mb-2">
                "{chain.prompt}"
              </p>
            )}

            {chain.description && !chain.prompt && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {chain.description}
              </p>
            )}

            {progress !== null && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{chain.entryCount} / {chain.maxEntries} links</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${chain.isComplete ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {chain.creatorUsername && (
                <span className="flex items-center gap-1.5">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={chain.creatorAvatar ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {(chain.creatorName ?? chain.creatorUsername)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {chain.creatorName ?? chain.creatorUsername}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {chain.entryCount} link{chain.entryCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {(chain.totalViews ?? 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                <Timestamp value={chain.createdAt} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
