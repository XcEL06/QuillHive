import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Star, ArrowRight } from 'lucide-react';

type FeaturedSlot = {
  id: number;
  slotKey: string;
  targetType: 'post' | 'job' | 'group' | 'user' | string;
  targetId: number;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
};

function targetHref(slot: FeaturedSlot): string {
  if (slot.linkUrl) return slot.linkUrl;
  switch (slot.targetType) {
    case 'post': return `/post/${slot.targetId}`;
    case 'job': return `/jobs`;
    case 'group': return `/groups/${slot.targetId}`;
    case 'user': return `/profile/${slot.targetId}`;
    default: return '#';
  }
}

export function FeaturedHero({ slotKey = 'home_hero' }: { slotKey?: string }) {
  const [slots, setSlots] = useState<FeaturedSlot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/featured')
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => setSlots(Array.isArray(d.slots) ? d.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const slot = slots.find((s) => s.slotKey === slotKey);
  if (!slot) return null;

  const href = targetHref(slot);
  const isExternal = !!slot.linkUrl && /^https?:/i.test(slot.linkUrl);
  const title = slot.title || 'Featured';
  const desc = slot.description;

  const inner = (
    <div className="group flex items-stretch gap-0 rounded-2xl overflow-hidden border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/40 transition-colors">
      {slot.imageUrl && (
        <div className="hidden sm:block w-32 h-auto shrink-0 bg-muted overflow-hidden">
          <img src={slot.imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">
          <Star className="w-3 h-3 fill-current" /> Featured
        </div>
        <h3 className="font-serif text-base md:text-lg font-bold text-foreground leading-tight mb-0.5 line-clamp-1">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>}
      </div>
      <div className="self-center pr-4 text-amber-600 opacity-100 transition-opacity dark:text-amber-300 sm:opacity-0 sm:group-hover:opacity-100">
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-4"
        data-testid="featured-hero-link"
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className="block mb-4" data-testid="featured-hero-link">
      {inner}
    </Link>
  );
}
