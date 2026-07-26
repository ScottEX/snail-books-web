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
.pv-back{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:${btnBgActive}}
.pv-back svg{width:16px;height:16px;stroke:#2C2626;stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:#2C2626;letter-spacing:.01em}
.pv-sub{font-size:10px;color:rgba(240,237,232,0.28);font-family:'DM Mono',monospace;margin-top:1px}
.pv-share-btn{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}
.pv-share-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-share-btn svg{width:16px;height:16px;stroke:#8C8583;stroke-width:2;fill:none}
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

export default function PdfPreviewPage({ batchId, batchNumber, supplier, fileUrl, title: customTitle, onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);
  const title = customTitle || t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = fileUrl
    || (supplier
      ? `/api/procurement-batches/${batchId}/pdf?supplier=${encodeURIComponent(supplier)}`
      : `/api/procurement-batches/${batchId}/pdf`);
  const isLocal = pdfUrl.startsWith('blob:');
  const viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`;
  const [exiting, setExiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currPage, setCurrPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [introSec, setIntroSec] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Seconds counter while loading — matches iOS behavior
  useEffect(() => {
    if (!loading) { setIntroSec(0); return; }
    const id = setInterval(() => setIntroSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

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

  // Swipe-back gesture on left edge (above iframe)
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

  // ── Share / download ──
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url: pdfUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(pdfUrl); } catch {}
    }
  }, [title, pdfUrl]);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${title}.pdf`;
    a.click();
  }, [pdfUrl, title]);

  return (
    <View style={st.container} {...swipeBack}>
      {createPortal(
        <div className={`pv-root${exiting ? ' out' : ''}${isLocal ? ' is-local' : ''}`} style={{ position: 'absolute', inset: 0, zIndex: 9999, maxWidth: CONTENT_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
          
          {/* Nav */}
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
            {!isLocal && (
              <div className="pv-share-btn" onClick={handleShare}>
                <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.5" y1="11" x2="15.5" y2="5.5"/><line x1="8.5" y1="13" x2="15.5" y2="18.5"/></svg>
              </div>
            )}
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
            />
          )}

          {/* Swipe-back edge */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 30, zIndex: 50 }}
          />

          {/* Loading overlay — matches iOS: spinner + label + seconds counter */}
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
