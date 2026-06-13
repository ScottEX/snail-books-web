// ═══════════════════════════════════════════
// useAsyncResource — 统一的"加载数据"小工具
//
// 替代 useEffect(() => load..., []) 里的 try/catch/setLoading 三件套。
// 返回 { data, loading, error, reload, setData }
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

export function useAsyncResource<T>(fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e?.message || '加载失败');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { data, loading, error, reload, setData };
}
