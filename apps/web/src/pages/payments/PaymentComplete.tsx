import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { getStoredToken } from '@/lib/api';
import { BackButton } from '@/components/ui/BackButton';

export default function PaymentComplete() {
  const search = useSearch();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your payment...');

  useEffect(() => {
    const params = new URLSearchParams(search);
    const transactionId = params.get('transaction_id');
    const txRef = params.get('tx_ref');
    if (!transactionId || !txRef) {
      setState('error');
      setMessage('The payment reference is missing. If you were charged, contact support with your receipt.');
      return;
    }

    fetch(`/api/payments/service/verify?transactionId=${encodeURIComponent(transactionId)}&txRef=${encodeURIComponent(txRef)}`, {
      headers: getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {},
    })
      .then(async response => {
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Payment verification failed');
        setState('success');
        setMessage('Payment confirmed. The creator has been credited and can begin your service.');
      })
      .catch(error => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Payment verification failed.');
      });
  }, [search]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <BackButton fallback="/workspace?tab=talent" />
        <div className="pt-8 text-center space-y-5">
        {state === 'loading' && <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />}
        {state === 'success' && <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />}
        {state === 'error' && <XCircle className="w-12 h-12 mx-auto text-destructive" />}
        <h1 className="text-2xl font-serif font-bold">{state === 'success' ? 'Payment complete' : state === 'error' ? 'Payment needs attention' : 'Confirming payment'}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {state !== 'loading' && <Link href="/workspace?tab=talent"><Button className="rounded-xl">Return to opportunities</Button></Link>}
        </div>
      </div>
    </AppLayout>
  );
}