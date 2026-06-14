import { useState, useEffect, useRef } from 'react';

interface ServerDate {
  /** 'YYYY-MM-DD' — today (Beijing time from server) */
  today: string;
  /** 'YYYY-MM-DD' — yesterday */
  yesterday: string;
  /** Current year (number) */
  year: number;
  /** Current month 1-12 */
  month: number;
  /** Compute date offset by N days: negative = past, positive = future */
  offset: (days: number) => string;
  /** True if d > today */
  isFuture: (d: string) => boolean;
  /** Whether the initial fetch has completed */
  ready: boolean;
}

let _cached: { today: string } | null = null;
let _fetchPromise: Promise<{ today: string }> | null = null;

async function _fetchServerDate(): Promise<{ today: string }> {
  if (_cached) return _cached;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    // Determine API base — use relative URL (same origin) on the same server
    const base = (typeof localStorage !== 'undefined' && localStorage.getItem('api_base')) || '';
    const resp = await fetch(base + '/api/server-date');
    if (!resp.ok) throw new Error('server-date fetch failed');
    const data = await resp.json();
    _cached = { today: data.date };
    return _cached;
  })();

  return _fetchPromise;
}

export function useServerDate(): ServerDate {
  const [ready, setReady] = useState(false);
  const ref = useRef<ServerDate>({
    today: '',
    yesterday: '',
    year: 0,
    month: 0,
    offset: () => '',
    isFuture: () => false,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    _fetchServerDate().then(({ today }) => {
      if (cancelled) return;
      const [y, m, d] = today.split('-').map(Number);
      const year = y, month = m;

      // Helper: offset days from today
      const offset = (days: number): string => {
        const dt = new Date(y, m - 1, d + days);
        return [
          dt.getFullYear(),
          String(dt.getMonth() + 1).padStart(2, '0'),
          String(dt.getDate()).padStart(2, '0'),
        ].join('-');
      };

      const yesterday = offset(-1);
      const isFuture = (date: string) => date > today;

      ref.current = { today, yesterday, year, month, offset, isFuture, ready: true };
      setReady(true);
    }).catch(() => {
      // If server-date fails (e.g. not logged in yet), fall back to local time
      if (cancelled) return;
      const d = new Date();
      const today = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
      const [y, m, day] = today.split('-').map(Number);
      const year = y, month = m;

      const offset = (days: number): string => {
        const dt = new Date(y, m - 1, day + days);
        return [
          dt.getFullYear(),
          String(dt.getMonth() + 1).padStart(2, '0'),
          String(dt.getDate()).padStart(2, '0'),
        ].join('-');
      };

      const yesterday = offset(-1);
      const isFuture = (date: string) => date > today;

      ref.current = { today, yesterday, year, month, offset, isFuture, ready: true };
      setReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  return ref.current;
}
