import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { getStoredToken } from '@/lib/api';
import { DollarSign, Plus, Loader2, TrendingUp, Wallet } from 'lucide-react';

type IncomeEntry = {
  id: number;
  amount: number;
  currency: string;
  source: string;
  description?: string;
  date: string;
  createdAt: string;
};

const SOURCES = ['sponsorship', 'tip', 'subscription', 'freelance', 'affiliate', 'sale', 'other'];

export default function IncomePage() {
  const { toast } = useToast();
  const t = useT();
  const token = getStoredToken();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', currency: 'USD', source: 'other', description: '', earnedAt: '' });

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchIncome = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/income', { headers: authHeaders });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json() as { logs?: IncomeEntry[] } | IncomeEntry[];
      setEntries(Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setLoadError(message);
      toast({ title: 'Could not load income', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncome(); }, []);

  const totalsByCurrency: Record<string, number> = {};
  const bySource: Record<string, Record<string, number>> = {};
  entries.forEach(e => {
    totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] ?? 0) + e.amount;
    bySource[e.source] ??= {};
    bySource[e.source][e.currency] = (bySource[e.source][e.currency] ?? 0) + e.amount;
  });

  const handleAdd = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          amount,
          currency: form.currency,
          source: form.source,
          description: form.description || undefined,
          date: new Date(form.earnedAt || new Date().toISOString()).toISOString(),
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setEntries(prev => [entry, ...prev]);
        setShowAdd(false);
        setForm({ amount: '', currency: 'USD', source: 'other', description: '', earnedAt: '' });
        toast({ title: t('income.logged', 'Income logged!') });
      } else {
        toast({ title: t('income.logFailed', 'Failed to log income'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('income.errorLogging', 'Error logging income'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-20 space-y-6">
        <div className="pt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
              <Wallet className="w-7 h-7 text-emerald-500" />
              {t('income.title', 'Income Tracker')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t('income.subtitle', 'Track your creator earnings in one place')}</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> {t('income.log', 'Log Income')}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-border/60 col-span-2 md:col-span-1">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{t('income.totalEarnings', 'Total Earnings')}</p>
              <div className="flex flex-wrap gap-2 text-3xl font-bold text-emerald-600">
                {Object.entries(totalsByCurrency).map(([currency, amount]) => (
                  <span key={currency}>{currency} {amount.toFixed(2)}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
            </CardContent>
          </Card>
          {Object.entries(bySource).slice(0, 4).map(([src, amounts]) => (
            <Card key={src} className="rounded-2xl border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1 capitalize">{src}</p>
                <p className="text-xl font-bold text-foreground">
                  {Object.entries(amounts).map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`).join(" · ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              {t('income.allEntries', 'All Entries')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>}
            {!loading && loadError && <p role="alert" className="text-destructive">{loadError}</p>}
            {!loading && !loadError && entries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t('income.empty', 'No income logged yet')}</p>
                <p className="text-sm mt-1">Log sponsorships, tips, and freelance payments here.</p>
                <Button className="mt-3 rounded-xl" size="sm" onClick={() => setShowAdd(true)}>
                  <Plus className="w-4 h-4 mr-2" /> {t('income.logFirst', 'Log your first entry')}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/60 p-4 hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">{entry.source}</Badge>
                      {entry.description && <span className="text-sm text-foreground">{entry.description}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-base font-bold text-emerald-600">+{entry.currency} {entry.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{t('income.logIncome', 'Log Income')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('income.amount', 'Amount')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('income.currency', 'Currency')}</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['USD','EUR','GBP','JPY','CAD','AUD','NGN','INR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('income.source', 'Source')}</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('income.description', 'Description')}</Label>
                <Input
                  placeholder={t('income.descriptionPlaceholder', 'e.g. Brand sponsorship from Acme')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('income.dateEarned', 'Date Earned')}</Label>
                <Input
                  type="date"
                  value={form.earnedAt}
                  onChange={e => setForm(f => ({ ...f, earnedAt: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleAdd} disabled={saving} className="rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                {t('income.logIncome', 'Log Income')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
