import { useState } from 'react';
import { getStoredToken } from '@/lib/api';
import { reportCaughtError } from '@/lib/reportCaughtError';

export function useAppreciations(postId: string) {
  const [loading, setLoading] = useState(false);
  const [appreciation, setAppreciation] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const authFetch = (path: string, options?: RequestInit) => {
    const token = getStoredToken();
    return fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
  };

  const fetchAppreciations = async () => {
    try {
      const res = await authFetch(`/api/posts/${postId}/appreciations`);
      const data = await res.json();
      setCounts(data.counts ?? {});
    } catch (error) {
      console.error('Failed to fetch appreciations:', error);
      reportCaughtError(error, { action: 'fetch_appreciations', postId });
    }
  };

  const addAppreciation = async (type: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/posts/${postId}/appreciate`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.action === 'removed') {
        setAppreciation(null);
      } else {
        setAppreciation(type);
      }
      await fetchAppreciations();
    } catch (error) {
      console.error('Failed to add appreciation:', error);
      reportCaughtError(error, { action: 'add_appreciation', postId, type });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    appreciation,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    addAppreciation,
    fetchAppreciations,
  };
}
