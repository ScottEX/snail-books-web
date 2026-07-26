import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors, ENTER_DURATION, EXIT_DURATION, ENTER_EASING, EXIT_EASING, CONTENT_MAX_WIDTH } from '../theme';
import { t } from '../i18n';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const NAV_H = 52;

const getCSS = (c: ThemeColors) => {
  const r = parseInt(c.bg.slice(1,3),16);
  const g = parseInt(c.bg.slice(3,5),16);
  const b = parseInt(c.bg.slice(5,7),16);
  const btnBg = `rgba(${r},${g},${b},0.30)`;
  const btnBgActive = `rgba(${r},${g},${b},0.45)`;
  return `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
.pv-nav{position:absolute;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:transparent;backdrop-filter:saturate(200%) blur(30px);border-bottom:0.5px solid rgba(0,0,0,0.06)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-nav-r{display:flex;align-items:center;gap:8px}
.pv-back{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:${btnBgActive}}
.pv-back svg{width:16px;height:16px;stroke:#2C2626;stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:#2C2626;letter-spacing:.01em}
.pv-sub{font-size:10px;color:rgba(240,237,232,0.28);font-family:'DM Mono',monospace;margin-top:1px}
.pv-action-btn{width:34px;height:34px;border-radius:17px;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}
.pv-action-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-action-btn svg{display:block}
.pv-iframe{display:block;border:none;touch-action:manipulation;-webkit-overflow-scrolling:touch}
@keyframes pv-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pv-slide-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
.pv-root{overscroll-behavior:none;background:#F9F7F4;animation:pv-slide-in ${ENTER_DURATION}ms ${ENTER_EASING} both}
.pv-root.out{animation:pv-slide-out ${EXIT_DURATION}ms ${EXIT_EASING} both}
`;
};

interface Props {
  batchId?: number;
  batchNumber?: number;
  supplier?: string;
  fileUrl?: string;
  title?: string;
  onBack: () => void;
}

// ── SVG Icons (matches iOS DownloadSvg / ImageDownloadSvg) ──
function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#2C2626" strokeWidth="2"/>
      <polyline points="7 10 12 15 17 10" stroke="#2C2626" strokeWidth="2"/>
      <line x1="12" y1="15" x2="12" y2="3" stroke="#2C2626" strokeWidth="2"/>
    </svg>
  );
}

function ImageDownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#2C2626" strokeWidth="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="#2C2626"/>
      <polyline points="21 15 16 10 5 21" stroke="#2C2626" strokeWidth="2"/>
      <line x1="12" y1="18" x2="12" y2="12" stroke="#2C2626" strokeWidth="2"/>
      <polyline points="9 15 12 12 15 15" stroke="#2C2626" strokeWidth="2"/>
    </svg>
  );
}

export default function PdfPreviewPage({ batchId, batchNumber, supplier, fileUrl, title: customTitle, onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);
  const title = customTitle || t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = fileUrl
    || (supplier
      ? `/api/procurement-batches/${batchId}/pdf?supplier=${encodeURIComponent(supplier)}`
      : `/api/procurement-batches/${batchId}/pdf`);
  const pngUrl = (batchId && batchId > 0) ? `/api/procurement-batches/${batchId}/png` : '';
  const isLocal = pdfUrl.startsWith('blob:');
  const viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`;

  const [exiting, setExiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currPage, setCurrPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [introSec, setIntroSec] = useState(0);
  const [actionLoading, setActionLoading] = useState<'download' | 'images' | null>(null);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Seconds counter while loading
  useEffect(() => {
    if (!loading) { setIntroSec(0); return; }
    const id = setInterval(() => setIntroSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  // Fetch page count for export-image button visibility (hide when >5 pages)
  useEffect(() => {
    if (!pngUrl) return;
    let cancelled = false;
    fetch(`${pngUrl}?pages=1`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && typeof data.pages === 'number') setPdfPages(data.pages);
        else if (!cancelled) setPdfPages(-1);
      })
      .catch(() => { if (!cancelled) setPdfPages(-1); });
    return () => { cancelled = true; };
  }, [pngUrl]);

  const handleBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onBack, EXIT_DURATION);
  }, [exiting, onBack]);

  const swipeBack = useSwipeBack(handleBack);

  // ── postMessage bridge ──
  const sendCmd = useCallback((type: string, data?: any) => {
    iframeRef.current?.contentWindow?.postMessage({ type, data }, window.location.origin);
  }, []);

  // Swipe-back gesture on left edge
  const swipeRef = useRef<{ sx: number; sy: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY };
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swipeRef.current.sx;
    const dy = Math.abs(e.touches[0].clientY - swipeRef.current.sy);
    if (dx > 40 && dx > dy * 1.5) {
      onBack();
      swipeRef.current = null;
    }
  }, [onBack]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const { type, data } = e.data ?? {};
      switch (type) {
        case 'pdf-ready':
          setLoading(false);
          setNumPages(data?.numPages || 0);
          break;
        case 'pdf-page-change':
          setCurrPage(data?.page || 1);
          break;
        case 'pdf-zoom-change':
          setZoomPct(Math.round((data?.zoom || 1) * 100));
          break;
        case 'pdf-error':
          setLoading(false);
          console.error('PDF load error:', data?.message);
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Poll iframe document.title as fallback (when postMessage blocked by sandbox)
  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(() => {
      if (cancelled || !loading) return;
      try {
        const title = iframeRef.current?.contentDocument?.title || '';
        if (title.startsWith('PDFJS_READY:')) {
          const numPages = parseInt(title.split(':')[1], 10) || 0;
          if (!cancelled) {
            setLoading(false);
            setNumPages(numPages);
          }
        }
      } catch {}
    }, 200);
    return () => { cancelled = true; clearInterval(poll); };
  }, [loading]);

  // ── Actions (matches iOS) ──
  const handleDownload = useCallback(async () => {
    setActionLoading('download');
    try {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${title}.pdf`;
      a.click();
    } finally {
      setActionLoading(null);
    }
  }, [pdfUrl, title]);

  const handleExportImage = useCallback(async () => {
    if (!pngUrl) return;
    setActionLoading('images');
    try {
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${title}.png`;
      a.click();
    } finally {
      setActionLoading(null);
    }
  }, [pngUrl, title]);

  const showExportImage = pngUrl !== '' && (pdfPages === null || pdfPages <= 5);

  return (
    <View style={st.container} {...swipeBack}>
      {createPortal(
        <div className={`pv-root${exiting ? ' out' : ''}${isLocal ? ' is-local' : ''}`} style={{ position: 'absolute', inset: 0, zIndex: 9999, maxWidth: CONTENT_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
          
          {/* Nav — matches iOS HistoryHeader layout: left=back+title, right=download+export */}
          <div className="pv-nav">
            <div className="pv-nav-l">
              <div className="pv-back" onClick={handleBack}>
                <svg viewBox="0 0 24 24"><polyline points="15,4 7,12 15,20"/></svg>
              </div>
              <div>
                <div className="pv-title">{title}</div>
                {numPages > 0 && (
                  <div className="pv-sub">{currPage} / {numPages}</div>
                )}
              </div>
            </div>
            <div className="pv-nav-r">
              {!isLocal && (
                <div className="pv-action-btn" onClick={handleDownload}>
                  {actionLoading === 'download' ? (
                    <LoadingSpinner label={false} size={16} color="#2C2626" />
                  ) : (
                    <DownloadIcon />
                  )}
                </div>
              )}
              {showExportImage && (
                <div className="pv-action-btn" onClick={handleExportImage}>
                  {actionLoading === 'images' ? (
                    <LoadingSpinner label={false} size={16} color="#2C2626" />
                  ) : (
                    <ImageDownloadIcon />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* iframe */}
          {!loadError && (
            <iframe
              ref={iframeRef}
              src={viewerUrl}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', border: 'none' }}
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onError={() => { setLoading(false); setLoadError('iframe load failed'); }}
              onLoad={() => {
                // Fallback: if pdf-ready from postMessage doesn't arrive
                setTimeout(() => setLoading(false), 1500);
              }}
            />
          )}

          {/* Swipe-back edge */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 30, zIndex: 50 }}
          />

          {/* Loading overlay */}
          {loading && !loadError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 60 }}>
              <LoadingSpinner label={false} size={36} />
              <div style={{ marginTop: 16, fontSize: 14, color: '#2C2626', fontWeight: '500' }}>
                {batchId && batchId > 0 ? t('pdfGenerating') : t('loading')}
              </div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: '800', color: c.primary }}>
                {introSec}s
              </div>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                <circle cx="24" cy="24" r="20" stroke="#e0dcd5" strokeWidth="1.5" fill="#f5f2eb" />
                <line x1="24" y1="14" x2="24" y2="28" />
                <circle cx="24" cy="33" r="1.5" fill="#999" stroke="none" />
              </svg>
              <div style={{ fontSize: 14, color: '#555' }}>{t('pdfLoadFailed')}</div>
              <div style={{ fontSize: 13, color: '#999' }}>{loadError}</div>
              <button style={{ padding: '10px 28px', borderRadius: 8, background: c.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setLoadError(''); setLoading(true); }}>
                {t('retry')}
              </button>
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: getCSS(c) }} />
        </div>,
        document.body
      )}
    </View>
  );
}

const getStyles = (_c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
});
