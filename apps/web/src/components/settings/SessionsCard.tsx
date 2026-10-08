import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Monitor, MapPin } from 'lucide-react';

type Session = {
  id: number;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: string;
  expiresAt: string;
};

type LoginEvent = {
  id: number;
  ipHash: string | null;
  userAgent: string | null;
  country: string | null;
  timezone: string | null;
  integrityStatus: string;
  riskScore: number;
  createdAt: string;
};

interface ToastApi {
  toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

export function SessionsCard({
  token,
  toast,
}: {
  token: string | null;
  toast: ToastApi['toast'];
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokingSession, setRevokingSession] = useState<number | null>(null);

  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch('/api/auth/sessions', { headers }),
        fetch('/api/auth/login-activity', { headers }),
      ]);
      if (!sRes.ok || !eRes.ok) throw new Error('Could not load session activity.');
      setSessions(await sRes.json());
      setEvents(await eRes.json());
    } catch (error) {
      setLoadError(true);
      toast({ title: 'Could not load session activity', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeAll = async () => {
    if (!token) return;
    if (!confirm('Revoke all device sessions? This device is included. Access tokens may remain valid for up to 15 minutes.')) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/auth/sessions/logout-all', { method: 'POST', headers });
      if (!res.ok) throw new Error('Could not revoke sessions.');
      const { revoked } = await res.json();
      toast({ title: 'Sessions revoked', description: `${revoked} refresh session(s) revoked. Access tokens may remain valid for up to 15 minutes.` });
      void load();
    } catch (error) {
      toast({ title: 'Could not revoke sessions', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setRevoking(false);
    }
  };

  const revokeSession = async (sessionId: number) => {
    setRevokingSession(sessionId);
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Could not revoke this session.');
      toast({ title: 'Session revoked', description: 'That device will need to sign in again. Existing access may remain valid for up to 15 minutes.' });
      void load();
    } catch (error) {
      toast({ title: 'Could not revoke session', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setRevokingSession(null);
    }
  };

  const formatUA = (ua: string | null): string => {
    if (!ua) return 'Unknown device';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Macintosh')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    return ua.slice(0, 40);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading session activity…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-sm text-muted-foreground">Session activity could not be loaded. Your devices have not been changed.</p>
        <Button variant="outline" onClick={() => void load()} className="mt-3 min-h-11 rounded-xl">Try again</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Active sessions & login activity</h3>
            <p className="text-sm text-muted-foreground">
              Review recent logins and sign out of devices you don't recognize.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={revokeAll}
          disabled={revoking || sessions.length === 0}
          className="min-h-11 rounded-xl"
        >
          {revoking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
          Revoke all sessions
        </Button>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Active sessions
        </h4>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions on record.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{formatUA(s.userAgent)}</p>
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(s.createdAt).toLocaleString()}
                    {s.ipHash ? ` · ${s.ipHash}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Expires {new Date(s.expiresAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void revokeSession(s.id)}
                    disabled={revokingSession === s.id}
                    aria-label={`Revoke ${formatUA(s.userAgent)} session`}
                  >
                    {revokingSession === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revoke'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Recent logins
        </h4>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login activity yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {events.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{formatUA(e.userAgent)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {e.country && (
                      <>
                        <MapPin className="w-3 h-3" />
                        {e.country}
                      </>
                    )}
                    {e.country && e.ipHash ? ' · ' : ''}
                    {e.ipHash || ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                  {e.integrityStatus !== 'normal' && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                      {e.integrityStatus}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
