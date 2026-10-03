import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Search, X, User, FileText, Hash, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/utils';
import { getStoredToken } from '@/lib/api';

interface SearchUser {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface SearchPost {
  id: number;
  title?: string | null;
  excerpt?: string | null;
  tags?: string[];
}

interface SearchTopic {
  id: number;
  name: string;
  slug: string;
  postCount?: number;
}

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
  topics: SearchTopic[];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setResults(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setFocused(false);
      setMobileExpanded(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const goToResults = () => {
    if (query.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
      setMobileExpanded(false);
      setQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') goToResults();
    if (e.key === 'Escape') { setFocused(false); setMobileExpanded(false); }
  };

  const showDropdown = focused && (loading || (results && (results.users.length > 0 || results.posts.length > 0 || results.topics.length > 0)));

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm mx-4">
      {/* Desktop: always visible bar */}
      <form className="hidden md:flex items-center relative" onSubmit={(e) => { e.preventDefault(); goToResults(); }}>
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          id="global-search"
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people, posts, topics..."
          className="pl-9 pr-4 h-9 rounded-full bg-muted/60 border-transparent focus:border-primary/30 focus:bg-background text-sm transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null); }} className="absolute right-3 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {/* Mobile: icon that expands */}
      <div className="md:hidden flex items-center">
        {mobileExpanded ? (
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none top-1/2 -translate-y-1/2" />
              <Input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="pl-9 pr-4 h-9 rounded-full bg-muted/60 text-sm"
              />
            </div>
            <button onClick={() => { setMobileExpanded(false); setQuery(''); setResults(null); }} className="text-muted-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setMobileExpanded(true)} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 w-[calc(100vw-1rem)] max-w-[320px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {results && !loading && (
            <>
              {results.users.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">People</div>
                  {results.users.map(u => (
                    <button key={u.id} onClick={() => { navigate(`/profile/${u.username}`); setFocused(false); setQuery(''); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left">
                      <Avatar className="w-8 h-8 shrink-0">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                        <AvatarFallback className="text-xs">{getInitials(u.displayName || u.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.posts.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 border-t border-t-border/30">Posts</div>
                  {results.posts.map(p => (
                    <button key={p.id} onClick={() => { navigate(`/post/${p.id}`); setFocused(false); setQuery(''); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.title || p.excerpt || 'Untitled'}</p>
                        {p.tags && p.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {p.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.topics.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 border-t border-t-border/30">Topics</div>
                  {results.topics.map(topic => (
                    <button key={topic.id} onClick={() => { navigate(`/explore?topic=${topic.slug}`); setFocused(false); setQuery(''); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left">
                      <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex items-center gap-2">
                        <p className="text-sm font-medium">{topic.name}</p>
                        {topic.postCount != null && <span className="text-xs text-muted-foreground">{topic.postCount} posts</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={goToResults} className="w-full text-left px-3 py-3 text-sm text-primary font-medium hover:bg-muted/60 transition-colors border-t border-border/50 flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                See all results for "<span className="font-semibold">{query}</span>"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
