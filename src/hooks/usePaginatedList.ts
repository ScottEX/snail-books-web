import { useState, useRef, useCallback } from 'react';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  totalAll?: number;
  pages: number;
}

interface UsePaginatedListOptions<T> {
  /** Fetch a page from the server. Receives (page, pageSize). */
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResult<T>>;
  pageSize?: number;
  /** Called when loading fails. Receives the error. */
  onError?: (err: unknown) => void;
}

export function usePaginatedList<T>({
  fetchPage,
  pageSize = 10,
  onError,
}: UsePaginatedListOptions<T>) {
  const [records, setRecords] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);
  const pageRef = useRef(1);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(async (pg: number, reset: boolean) => {
    if (loadingRef.current && !reset) return;
    loadingRef.current = true;
    const reqId = ++reqIdRef.current;
    if (reset) setLoading(true);
    try {
      const result = await fetchPage(pg, pageSize);
      if (reqId !== reqIdRef.current) return;
      setRecords(prev => reset ? result.items : [...prev, ...result.items]);
      setPage(pg);
      pageRef.current = pg;
      setTotal(result.total || 0);
      setTotalAll(result.totalAll ?? result.total ?? 0);
      setHasMore(pg < (result.pages || 1));
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      onError?.(err);
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, [fetchPage, pageSize, onError]);

  // For FlatList onEndReached — debounced 150ms
  const onEndReached = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    if (scrollTimerRef.current) return;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      loadPage(pageRef.current + 1, false);
    }, 150);
  }, [hasMore, loadPage]);

  // For ScrollView onScroll — debounced 150ms, checks scroll position
  const handleScroll = useCallback((e: any) => {
    if (loadingRef.current || !hasMore) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 60) {
      if (!scrollTimerRef.current) {
        scrollTimerRef.current = setTimeout(() => {
          scrollTimerRef.current = null;
          loadPage(pageRef.current + 1, false);
        }, 150);
      }
    }
  }, [hasMore, loadPage]);

  return {
    records,
    setRecords,
    page,
    total,
    totalAll,
    hasMore,
    loading,
    loadPage,
    onEndReached,
    handleScroll,
  } as const;
}
