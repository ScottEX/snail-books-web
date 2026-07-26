import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTheme, ThemeColors, ENTER_DURATION, EXIT_DURATION, ENTER_EASING, EXIT_EASING, CONTENT_MAX_WIDTH } from '../theme';
import { t, getLang } from '../i18n';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const NAV_H = 50;
const ZOOM_STEP = 0.25;

interface Props {
  batchId?: number;
  batchNumber?: number;
  supplier?: string;
  fileUrl?: string;
  title?: string;
  onBack: () => void;
}

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
.pv-share-btn{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}
.pv-share-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-share-btn svg{width:16px;height:16px;stroke:#8C8583;stroke-width:2;fill:none}
.pv-vp{position:absolute;top:${NAV_H}px;left:0;right:0;bottom:0;overflow:auto;background:#F9F7F4;-webkit-overflow-scrolling:touch}
.pv-pages{padding:12px 0;min-height:100%}
.pv-pages .react-pdf__Page{margin-bottom:12px}
.pv-pages canvas{display:block;box-shadow:0 1px 3px rgba(0,0,0,.12);border-radius:2px;height:auto!important}
.pv-zoom-badge{position:absolute;top:${NAV_H + 10}px;right:12px;z-index:90;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);color:rgba(255,255,255,0.9);font-size:11px;font-family:'DM Mono',monospace;padding:4px 10px;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .2s}
.pv-zoom-badge.on{opacity:1}
.pv-zoom-strip{position:absolute;right:16px;bottom:24px;z-index:95;display:flex;flex-direction:column;gap:6px}
.pv-zoom-btn{width:36px;height:36px;border-radius:50%;background:${btnBg};backdrop-filter:blur(12px);border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 12px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent}
.pv-zoom-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-zoom-btn svg{width:16px;height:16px;stroke:#2C2626;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.pv-err{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#555;font-size:14px;text-align:center;padding:40px}
.pv-err svg{display:block}
.pv-err-msg{font-size:13px;color:#999}
.pv-err-btn{padding:10px 28px;border-radius:8px;background:${c.accent};color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s}
.pv-err-btn:active{opacity:.8}
.pv-intro-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:200;pointer-events:none}
.pv-intro{background:#F9F7F4;border-radius:8px;padding:16px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.pv-intro.on{opacity:1;transform:translateY(0)}
.pv-intro-text{color:#999;font-size:15px;text-align:center;white-space:nowrap}
.pv-intro-sec{font-size:36px;font-weight:800;font-family:'DM Mono',monospace}
@keyframes pv-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pv-slide-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
.pv-root{background:linear-gradient(to bottom,transparent 56px,#F9F7F4 56px);animation:pv-slide-in ${ENTER_DURATION}ms ${ENTER_EASING} both}
.pv-root.out{animation:pv-slide-out ${EXIT_DURATION}ms ${EXIT_EASING} both}
`;
};

export default function PdfPreviewPage({ batchId, batchNumber, supplier, fileUrl, title: customTitle, onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);
  const title = customTitle || t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = fileUrl
    || (supplier
      ? `/api/procurement-batches/${batchId}/pdf?supplier=${encodeURIComponent(supplier)}`
      : `/api/procurement-batches/${batchId}/pdf`);
  const isLocal = pdfUrl.startsWith('blob:');

  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const pdfBlobRef = useRef<Blob | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [exiting, setExiting] = useState(false);
  const [introSec, setIntroSec] = useState(0);

  // ── Zoom state ──
  // `scale` = committed scale (triggers react-pdf re-render, crisp pixels)
  // `cssScale` = live CSS transform during pinch (GPU-accelerated, no re-render)
  const [scale, setScale] = useState(1);
  const committedScaleRef = useRef(1);
  const cssScaleRef = useRef(1);
  const pagesElRef = useRef<HTMLDivElement | null>(null);
  const [showZoomBadge, setShowZoomBadge] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ active: false, startDist: 0, effectiveBase: 1, cssBase: 1, cx: 0, cy: 0 });
  const lastTapRef = useRef(0);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafRef = useRef(0);

  // Base width = container width (fills screen at scale=1)
  const [baseW, setBaseW] = useState(340);
  useEffect(() => {
    const calc = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      setBaseW(Math.max(100, w - 24));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const pageWidth = useMemo(() => Math.max(100, baseW * scale), [baseW, scale]);

  // After react-pdf renders new canvas, ensure CSS transform is scale(1)
  useEffect(() => {
    if (cssScaleRef.current === 1) return;
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        const el = pagesElRef.current;
        if (el) {
          el.style.transform = 'scale(1)';
          el.style.transformOrigin = 'top center';
          el.style.transition = '';
          cssScaleRef.current = 1;
        }
      });
    });
    return () => { cancelAnimationFrame(id1); };
  }, [scale]);

  // Apply CSS transform for smooth zoom (no react-pdf re-render)
  const applyCssScale = (s: number) => {
    const el = pagesElRef.current;
    if (!el) return;
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    cssScaleRef.current = clamped;
    el.style.transform = `scale(${clamped})`;
    el.style.transformOrigin = 'top center';
  };

  const zoomPct = Math.round(scale * 100);

  // ── Apply scale (buttons / double-tap: immediate both CSS + react-pdf) ──
  const applyScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    applyCssScale(clamped);
    committedScaleRef.current = clamped;
    setScale(clamped);
    setShowZoomBadge(true);
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setShowZoomBadge(false), 1500);
  }, []);

  const handleBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onBack, EXIT_DURATION);
  }, [exiting, onBack]);

  const swipeBack = useSwipeBack(handleBack);

  // ── Viewport meta (browser pinch-zoom as fallback) ──
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) return;
    const prev = meta.content;
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
    return () => { meta.content = prev; };
  }, []);

  // ── Pinch-to-zoom (CSS transform during gesture, sync on end) ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const getDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getMid = (touches: TouchList, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return {
        x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
        y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top,
      };
    };

    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        cancelAnimationFrame(rafRef.current);
        const el = pagesElRef.current;
        if (!el) return;
        const mid = getMid(e.touches, el);
        pinchRef.current = {
          active: true,
          startDist: getDist(e.touches),
          effectiveBase: committedScaleRef.current,
          cssBase: cssScaleRef.current,
          cx: mid.x,
          cy: mid.y,
        };
        // Set origin to pinch center
        el.style.transformOrigin = `${mid.x}px ${mid.y}px`;
      }
    };

    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current.active) {
        e.preventDefault();
        const ratio = getDist(e.touches) / pinchRef.current.startDist;
        const effective = pinchRef.current.effectiveBase * ratio;
        const el = pagesElRef.current;
        if (!el) return;
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, effective));
        const cssS = clamped / (pinchRef.current.effectiveBase / pinchRef.current.cssBase);
        cssScaleRef.current = cssS;
        el.style.transform = `scale(${cssS})`;
      }
    };

    const onTE = () => {
      if (!pinchRef.current.active) return;
      pinchRef.current.active = false;
      // Final effective scale = cssScale × committed base
      const final = cssScaleRef.current * committedScaleRef.current;
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, final));
      committedScaleRef.current = clamped;
      setScale(clamped);
      setShowZoomBadge(true);
      clearTimeout(zoomTimer.current);
      zoomTimer.current = setTimeout(() => setShowZoomBadge(false), 1500);
    };

    vp.addEventListener('touchstart', onTS, { passive: false });
    vp.addEventListener('touchmove', onTM, { passive: false });
    vp.addEventListener('touchend', onTE);

    return () => {
      vp.removeEventListener('touchstart', onTS);
      vp.removeEventListener('touchmove', onTM);
      vp.removeEventListener('touchend', onTE);
    };
  }, []);

  // ── Double-tap zoom toggle ──
  const onViewportTouchEnd = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const cur = committedScaleRef.current;
      applyScale(cur > 1.1 ? 1 : 2);
    }
    lastTapRef.current = now;
  }, [applyScale]);

  // ── Desktop Ctrl+wheel zoom ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        applyScale(committedScaleRef.current * (e.deltaY > 0 ? 0.9 : 1.1));
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [scale, applyScale]);

  // ── Fetch PDF ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(pdfUrl, { credentials: 'include', headers: { 'X-Lang': getLang() } });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty PDF (0 bytes)');
        if (!cancelled) {
          setPdfBlobUrl(URL.createObjectURL(blob));
          pdfBlobRef.current = blob;
        }
      } catch (e: any) {
        if (!cancelled) { setPdfError(e?.message || String(e)); setPdfLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Loading countdown ──
  useEffect(() => {
    if (!pdfLoading) { setIntroSec(0); return; }
    setIntroSec(0);
    const id = setInterval(() => setIntroSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [pdfLoading]);

  const doDownload = useCallback(async () => {
    const blob = pdfBlobRef.current;
    if (!blob) return;
    const file = new File([blob], `procurement_${batchId}_${getLang()}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if ((e as DOMException).name === 'AbortError') return; }
    }
    const dlBlob = new Blob([blob], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(dlBlob);
    a.download = `procurement_${batchId}_${getLang()}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [batchId, title]);

  const doDownloadImage = useCallback(async () => {
    const pngUrl = batchId
      ? (supplier
        ? `/api/procurement-batches/${batchId}/png?supplier=${encodeURIComponent(supplier)}`
        : `/api/procurement-batches/${batchId}/png`)
      : `${fileUrl}/png`;
    const dlName = batchId ? `procurement_${batchId}_${getLang()}.png` : `invoice_${getLang()}.png`;
    try {
      const res = await fetch(pngUrl, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], dlName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); return; }
        catch (e) { if ((e as DOMException).name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = dlName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { /* silently fail */ }
  }, [batchId, supplier, title, fileUrl]);

  return (
    <View style={st.container} {...swipeBack}>
      {createPortal(<div className={`pv-root${exiting ? ' out' : ''}`} style={{ position: 'absolute', inset: 0, zIndex: 9999, marginLeft: 'auto', marginRight: 'auto', maxWidth: CONTENT_MAX_WIDTH }}>
        <style dangerouslySetInnerHTML={{ __html: getCSS(c) }} />

        {/* Navbar */}
        <div className="pv-nav">
          <div className="pv-nav-l">
            <div className="pv-back" onClick={handleBack}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></div>
            <div><div className="pv-title">{title}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isLocal && (
            <>
            <div className="pv-share-btn" onClick={doDownload} title={t('downloadPdf')}>
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#2C2626" strokeWidth="2" fill="none"/><polyline points="7 10 12 15 17 10" stroke="#2C2626" strokeWidth="2" fill="none"/><line x1="12" y1="15" x2="12" y2="3" stroke="#2C2626" strokeWidth="2"/></svg>
            </div>
            {numPages > 0 && numPages <= 5 && (
            <div className="pv-share-btn" onClick={doDownloadImage} title={t('downloadImage')}>
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#2C2626" strokeWidth="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="#2C2626"/><polyline points="21 15 16 10 5 21" stroke="#2C2626" strokeWidth="2" fill="none"/><line x1="12" y1="18" x2="12" y2="12" stroke="#2C2626" strokeWidth="2"/><polyline points="9 15 12 12 15 15" stroke="#2C2626" strokeWidth="2" fill="none"/></svg>
            </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* Zoom badge */}
        <div className={`pv-zoom-badge${showZoomBadge ? ' on' : ''}`}>{zoomPct}%</div>

        {/* Loading */}
        {pdfLoading && !pdfError && (
          <div className="pv-intro-overlay">
            <div className="pv-intro on">
              <div className="pv-intro-text">{t('pdfGenerating')}</div>
              <div className="pv-intro-sec" style={{ color: c.primary }}>{introSec}s</div>
            </div>
          </div>
        )}

        {/* Error */}
        {pdfError && (
          <div className="pv-err" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
              <circle cx="24" cy="24" r="20" stroke="#e0dcd5" strokeWidth="1.5" fill="#f5f2eb" />
              <line x1="24" y1="14" x2="24" y2="28" />
              <circle cx="24" cy="33" r="1.5" fill="#999" stroke="none" />
            </svg>
            <div>{t('pdfLoadFailed')}</div>
            <div className="pv-err-msg">{pdfError}</div>
            <button className="pv-err-btn" onClick={() => { setPdfError(''); setPdfLoading(true); setPdfBlobUrl(''); }}>{t('retry')}</button>
          </div>
        )}

        {/* PDF viewport with pinch/double-tap/scroll handlers */}
        <div className="pv-vp" ref={viewportRef} onTouchEnd={onViewportTouchEnd}>
          <div className="pv-pages">
            <div ref={(el) => { containerRef.current = el; pagesElRef.current = el; }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100%', width: 'max-content' as any }}>
            {pdfBlobUrl && !pdfError && (
              <Document
                file={pdfBlobUrl}
                onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoading(false); }}
                onLoadError={(e: any) => { setPdfError(e?.message || 'PDF parse error'); setPdfLoading(false); }}
                loading={null}
              >
                {Array.from({ length: numPages || 1 }, (_, i) => i + 1).map(p => (
                  <Page
                    key={p}
                    pageNumber={p}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                ))}
              </Document>
            )}
            </div>
          </div>
        </div>

        {/* Zoom buttons */}
        {!pdfLoading && !pdfError && pdfBlobUrl && (
          <div className="pv-zoom-strip">
            <div className="pv-zoom-btn" onClick={() => applyScale(scale + ZOOM_STEP)}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div className="pv-zoom-btn" onClick={() => applyScale(1)}>
              <svg viewBox="0 0 24 24"><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="700" fill="#2C2626" fontFamily="system-ui">1x</text></svg>
            </div>
            <div className="pv-zoom-btn" onClick={() => applyScale(scale - ZOOM_STEP)}>
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
          </div>
        )}
      </div>, document.body)}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
