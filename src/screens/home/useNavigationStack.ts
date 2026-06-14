import { useState, useEffect, useRef } from 'react';

export type SubPage = 'profile' | 'recon' | 'expense' | 'daily' | 'proc' | 'pdf' | 'expdetail' | 'usermgmt' | 'userdetail';

interface UseNavigationStackParams {
  /** URL-driven PDF preview route from App.tsx */
  previewRoute?: { id: number; number: number } | null;
  /** Called when PDF is dismissed */
  onClosePreview?: () => void;
  /** Per-page payload cleanup callbacks */
  onPopProc?: () => void;
  onPopUserDetail?: () => void;
}

export function useNavigationStack({
  previewRoute,
  onClosePreview,
  onPopProc,
  onPopUserDetail,
}: UseNavigationStackParams) {
  // Hydrate pageStack from history.state so a refresh lands the user
  // back on the same sub-page they were viewing.
  const [pageStack, setPageStack] = useState<SubPage[]>(() => {
    try {
      const s = (history.state as any)?.stack;
      return Array.isArray(s) ? (s as SubPage[]) : [];
    } catch { return []; }
  });

  const [removing, setRemoving] = useState<SubPage | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ id: number; number: number } | null>(() => {
    if (previewRoute) return previewRoute;
    try {
      const m = window.location.hash.match(/^#\/preview-pdf\?id=(\d+)(?:&.*)?$/);
      if (!m) return null;
      const qs = window.location.hash.split('?')[1] || '';
      const num = parseInt(new URLSearchParams(qs).get('number') || '0', 10);
      return { id: parseInt(m[1], 10), number: num };
    } catch { return null; }
  });

  // Mirror of pageStack for synchronous reads inside popstate / popPage
  const pageStackRef = useRef<SubPage[]>([]);
  useEffect(() => { pageStackRef.current = pageStack; }, [pageStack]);

  // Persist every change to history.state for refresh restoration
  useEffect(() => {
    try {
      history.replaceState(
        { app: 'snail-books', stack: pageStack },
        '',
        location.href,
      );
    } catch {}
  }, [pageStack]);

  const pushPage = (p: SubPage) => setPageStack(s => s.includes(p) ? s : [...s, p]);

  const popPage = () => {
    const stack = pageStackRef.current;
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];
    setRemoving(top);
    setTimeout(() => {
      setPageStack(s => s.slice(0, -1));
      setRemoving(null);
      if (top === 'proc') onPopProc?.();
      if (top === 'userdetail') onPopUserDetail?.();
      if (top === 'pdf') {
        setPdfPreview(null);
        onClosePreview?.();
      }
    }, 280);
  };

  // Sync URL-driven PDF preview with pageStack
  const ignorePopstateUntil = useRef(0);
  useEffect(() => {
    if (previewRoute) {
      setPdfPreview(previewRoute);
      setPageStack(s => s.includes('pdf') ? s : [...s, 'pdf']);
      ignorePopstateUntil.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRoute]);

  // Browser back / iOS swipe-back
  useEffect(() => {
    try {
      if (history.state === null || (history.state as any)?.app !== 'snail-books') {
        history.pushState({ app: 'snail-books' }, '', location.href);
      }
    } catch {}
    const onPopState = () => {
      if (Date.now() < ignorePopstateUntil.current) return;
      if (pageStackRef.current.length > 0) {
        popPage();
        setTimeout(() => {
          try {
            history.pushState({ app: 'snail-books' }, '', location.href);
          } catch {}
        }, 0);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pageStack,
    removing,
    pdfPreview,
    setPdfPreview,
    pushPage,
    popPage,
    clearStack: () => setPageStack([]),
  };
}
