import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { reportCaughtError } from '@/lib/reportCaughtError';
import { getActiveReadingDelta } from '@/lib/readingActivity';

export function useReadingProgress(postId: number | null, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const [percent, setPercent] = useState(0);
  const lastSentRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const activeMs = useRef(0);
  const baseReadTimeMs = useRef(0);
  const lastActivityAt = useRef(0);
  const lastTickAt = useRef(0);

  const sendProgress = (value: number) => {
    if (!postId) return;
    const elapsed = Math.min(12 * 60 * 60 * 1000, baseReadTimeMs.current + activeMs.current);
    void apiRequest('PUT', `/api/reading-progress/${postId}`, { percent: value, readTimeMs: elapsed }).catch((error) => {
      console.error('[reading-progress] save failed', error);
      reportCaughtError(error, { action: 'save_reading_progress', postId });
    });
  };

  useEffect(() => {
    if (!enabled || !postId) return;

    activeMs.current = 0;
    baseReadTimeMs.current = 0;
    lastActivityAt.current = 0;
    const sampleActivity = () => {
      const now = Date.now();
      activeMs.current += getActiveReadingDelta(
        now,
        lastTickAt.current,
        lastActivityAt.current,
        document.visibilityState === 'visible',
        document.hasFocus(),
      );
      lastTickAt.current = now;
    };
    const markActivity = () => {
      lastActivityAt.current = Date.now();
    };
    lastTickAt.current = Date.now();
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    const timer = window.setInterval(sampleActivity, 1_000);
    document.addEventListener('visibilitychange', sampleActivity);
    let cancelled = false;
    apiRequest('GET', `/api/reading-progress/${postId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.percent === 'number') setPercent(data.percent);
        if (typeof data?.readTimeMs === 'number' && Number.isFinite(data.readTimeMs)) {
          baseReadTimeMs.current = Math.max(0, Math.min(12 * 60 * 60 * 1000, data.readTimeMs));
        }
      })
      .catch((error) => reportCaughtError(error, { action: 'load_reading_progress', postId }));
    return () => {
      cancelled = true;
      sampleActivity();
      window.clearInterval(timer);
      activityEvents.forEach(event => window.removeEventListener(event, markActivity));
      document.removeEventListener('visibilitychange', sampleActivity);
    };
  }, [postId, enabled]);

  useEffect(() => {
    if (!enabled || !postId) return;

    const compute = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max <= 0 ? 100 : Math.min(100, Math.max(0, (scrollTop / max) * 100));
      setPercent(p);

      const now = Date.now();
      if (Math.abs(p - lastSentRef.current) >= 5 || now - lastSentAtRef.current > 15_000) {
        lastSentRef.current = p;
        lastSentAtRef.current = now;
        sendProgress(p);
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      const now = Date.now();
      activeMs.current += getActiveReadingDelta(
        now,
        lastTickAt.current,
        lastActivityAt.current,
        document.visibilityState === 'visible',
        document.hasFocus(),
      );
      lastTickAt.current = now;
      sendProgress(lastSentRef.current);
    };
  }, [postId, enabled]);

  return percent;
}
