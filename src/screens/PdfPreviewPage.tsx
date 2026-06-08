import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTheme, ThemeColors } from '../theme';
import { t, getLang } from '../i18n';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const NAV_H = 56;

const getCSS = (c: ThemeColors) => {
  const r = parseInt(c.bg.slice(1,3),16);
  const g = parseInt(c.bg.slice(3,5),16);
  const b = parseInt(c.bg.slice(5,7),16);
  const btnBg = `rgba(${r},${g},${b},0.30)`;
  const btnBgActive = `rgba(${r},${g},${b},0.45)`;
  return `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html.pv-lock{overflow:hidden;touch-action:none}
.pv-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:transparent;backdrop-filter:saturate(200%) blur(30px);border-bottom:0.5px solid rgba(0,0,0,0.06)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-back{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:${btnBgActive}}
.pv-back svg{width:16px;height:16px;stroke:#2C2626;stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:#2C2626;letter-spacing:.01em}
.pv-sub{font-size:10px;color:rgba(240,237,232,0.28);font-family:'DM Mono',monospace;margin-top:1px}
.pv-share-btn{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}
.pv-share-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-share-btn svg{width:16px;height:16px;stroke:#8C8583;stroke-width:2;fill:none}
.pv-pill{position:fixed;top:${NAV_H + 12}px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.25);backdrop-filter:blur(12px);border:0.5px solid rgba(0,0,0,0.10);border-radius:20px;padding:4px 14px;font-size:11px;font-family:'DM Mono',monospace;color:rgba(240,237,232,0.5);z-index:90;pointer-events:none}
.pv-zi{position:fixed;top:${NAV_H + 12}px;right:16px;background:rgba(0,0,0,0.25);backdrop-filter:blur(12px);border:0.5px solid rgba(0,0,0,0.10);border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Mono',monospace;color:rgba(240,237,232,0.5);z-index:90;opacity:0;transition:opacity .25s;pointer-events:none}
.pv-zi.on{opacity:1}
.pv-vp{position:fixed;top:${NAV_H}px;left:0;right:0;bottom:0;overflow:hidden;background:#F9F7F4}
.pv-pdf-wrap{position:absolute;top:0;left:50%;transform-origin:center top;will-change:transform;touch-action:none;user-select:none;display:flex;flex-direction:column;align-items:center}
.pv-pdf-wrap canvas{display:block;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.12);border-radius:2px}
.pv-pdf-wrap .react-pdf__Page{margin-bottom:12px}
.pv-zoom-strip{position:fixed;right:16px;bottom:18px;z-index:95;display:flex;flex-direction:column;gap:6px}
.pv-zoom-btn{width:40px;height:40px;border-radius:50%;background:${btnBg};backdrop-filter:blur(12px);border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 12px rgba(0,0,0,.35)}
.pv-zoom-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-zoom-btn svg{width:16px;height:16px;stroke:rgba(240,237,232,0.5);stroke-width:2;fill:none}
.pv-toast{position:fixed;bottom:16px;left:50%;transform:translate(-50%,8px);background:rgba(30,30,34,.95);backdrop-filter:blur(16px);border:0.5px solid rgba(0,0,0,0.10);border-radius:10px;padding:10px 18px;font-size:12px;color:#F0EDE8;display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.pv-toast.on{opacity:1;transform:translate(-50%,0)}
.pv-intro-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:200;pointer-events:none}
.pv-intro{background:#fff;border-radius:8px;padding:16px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.pv-intro.on{opacity:1;transform:translateY(0)}
.pv-intro-text{color:#999;font-size:15px;text-align:center;white-space:nowrap}
.pv-intro-sec{font-size:36px;font-weight:800;font-family:'DM Mono',monospace}
.pv-sh-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .25s}
.pv-sh-overlay.open{opacity:1;pointer-events:auto}
.pv-sh{position:absolute;bottom:0;left:0;right:0;max-height:70vh;background:#F9F7F4;border-radius:20px 20px 0 0;padding:16px 16px 24px;transform:translateY(20px);transition:transform .3s cubic-bezier(.4,0,.2,1)}
.pv-sh-overlay.open .pv-sh{transform:translateY(0)}
.pv-sh-handle{width:36px;height:4px;background:#D1CDC6;border-radius:2px;margin:0 auto 16px}
.pv-err{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#555;font-size:14px;text-align:center;padding:40px}
.pv-err svg{display:block}
.pv-err-msg{font-size:13px;color:#999}
.pv-err-btn{padding:10px 28px;border-radius:8px;background:${c.accent};color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s}
.pv-err-btn:active{opacity:.8}
.pv-loading-mask{position:fixed;inset:0;z-index:195;background:rgba(0,0,0,0.4);pointer-events:auto}
@keyframes pv-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pv-slide-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
.pv-root{animation:pv-slide-in 280ms cubic-bezier(0.215,0.61,0.355,1) both}
.pv-root.out{animation:pv-slide-out 250ms cubic-bezier(0.55,0.055,0.675,0.19) both}
`;
};

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf`;

  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [zoomVis, setZoomVis] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [pageW, setPageW] = useState(340);
  const [shareOpen, setShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ icon: string; text: string } | null>(null);
  const [introSec, setIntroSec] = useState(1);
  const [exiting, setExiting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const phRef = useRef(0); // page height
  const numPagesRef = useRef(0);
  const setPageRef = useRef(setCurrentPage);
  setPageRef.current = setCurrentPage;
  numPagesRef.current = numPages;

  const handleBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onBack, 250);
  }, [exiting, onBack]);

  // Fetch PDF as blob with auth cookies, then create object URL for react-pdf
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(pdfUrl, { credentials: 'include', headers: { 'X-Lang': getLang() } });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty PDF (0 bytes)');
        if (!cancelled) setPdfBlobUrl(URL.createObjectURL(blob));
      } catch (e: any) {
        if (!cancelled) { setPdfError(e?.message || String(e)); setPdfLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, stx: 0, sty: 0 });
  const pinchRef = useRef({ dist: 0, scale: 1 });
  const lastTapRef = useRef(0);
  const rafRef = useRef(0);
  const ziTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { document.documentElement.classList.add('pv-lock'); return () => document.documentElement.classList.remove('pv-lock'); }, []);

  // intro elapsed counter (1 → 2 → 3 …), ticks while PDF loads
  useEffect(() => {
    if (!pdfLoading || pdfError) return;
    const t = setTimeout(() => setIntroSec(s => s + 1), 1000);
    return () => clearTimeout(t);
  }, [introSec, pdfLoading, pdfError]);

  const applyTransform = useCallback((animated: boolean) => {
    const el = wrapRef.current; if (!el) return;
    const g = gRef.current;
    el.style.transition = animated ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    el.style.transform = `translate(-50%, 0) translate(${g.tx}px, ${g.ty}px) scale(${g.scale})`;
    if (animated) setTimeout(() => { if (el) el.style.transition = 'none'; }, 260);
    // sync current page
    if (phRef.current > 0 && numPagesRef.current > 0) {
      const p = Math.max(1, Math.min(numPagesRef.current, Math.round((-g.ty) / phRef.current) + 1));
      setPageRef.current(p);
    }
  }, []);

  const clamp = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const g = gRef.current;
    const vp = el.parentElement; if (!vp) return;
    const cw = el.scrollWidth * g.scale;
    const ch = el.scrollHeight * g.scale;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const mx = Math.max(0, (cw - vw) / 2);
    const scrollH = Math.max(0, ch - vh);
    g.tx = Math.max(-mx, Math.min(mx, g.tx));
    g.ty = Math.max(-scrollH - 20, Math.min(20, g.ty));
  }, []);

  const flushZoom = useCallback((animated: boolean) => {
    setZoomPct(Math.round(gRef.current.scale * 100));
    setZoomVis(true);
    clearTimeout(ziTimer.current);
    ziTimer.current = setTimeout(() => setZoomVis(false), 1500);
  }, []);

  const scheduleApply = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      clamp(); applyTransform(false);
    });
  }, [clamp, applyTransform]);

  const initZoom = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const vp = el.parentElement; if (!vp) return;
    setPageW(vp.clientWidth);
    gRef.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform(false);
  }, [applyTransform]);

  useEffect(() => {
    if (!pdfLoading && wrapRef.current) setTimeout(initZoom, 100);
  }, [pdfLoading, initZoom]);

  // capture page height after canvases render
  useEffect(() => {
    if (numPages > 0 && !pdfLoading) {
      requestAnimationFrame(() => {
        const canvas = wrapRef.current?.querySelector('canvas');
        if (canvas) phRef.current = canvas.clientHeight;
      });
    }
  }, [numPages, pdfLoading]);

  // ── 手势事件 ──
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;

    const onMD = (e: MouseEvent) => {
      e.preventDefault();
      const g = gRef.current;
      dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, stx: g.tx, sty: g.ty };
    };
    const onMM = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const d = dragRef.current;
      gRef.current.tx = d.stx + (e.clientX - d.sx);
      gRef.current.ty = d.sty + (e.clientY - d.sy);
      scheduleApply();
    };
    const onMU = () => { dragRef.current.active = false; clamp(); applyTransform(true); };
    const onWh = (e: WheelEvent) => {
      e.preventDefault();
      const g = gRef.current;
      if (e.ctrlKey || e.metaKey) {
        g.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.scale + (e.deltaY > 0 ? -0.08 : 0.08)));
        flushZoom(false);
      } else {
        g.ty -= e.deltaY;
      }
      clamp(); applyTransform(false);
    };

    el.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    el.addEventListener('wheel', onWh, { passive: false });

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          const ns = gRef.current.scale > 1.1 ? 1 : 2;
          gRef.current.scale = ns; gRef.current.tx = 0; gRef.current.ty = 0;
          clamp(); applyTransform(true); flushZoom(true); lastTapRef.current = 0; return;
        }
        lastTapRef.current = now;
        dragRef.current = { active: true, sx: e.touches[0].clientX, sy: e.touches[0].clientY, stx: gRef.current.tx, sty: gRef.current.ty };
      } else if (e.touches.length === 2) {
        pinchRef.current = { dist: dist(e.touches), scale: gRef.current.scale };
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (dragRef.current.active && e.touches.length === 1) {
        const d = dragRef.current;
        gRef.current.tx = d.stx + (e.touches[0].clientX - d.sx);
        gRef.current.ty = d.sty + (e.touches[0].clientY - d.sy);
        scheduleApply();
      } else if (e.touches.length === 2 && pinchRef.current.dist > 0) {
        const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.scale * (dist(e.touches) / pinchRef.current.dist)));
        gRef.current.scale = ns;
        clamp(); applyTransform(false); flushZoom(false);
      }
    };
    const onTE = (e: TouchEvent) => {
      if (e.touches.length === 0) { dragRef.current.active = false; clamp(); applyTransform(true); }
      else if (e.touches.length === 1) { dragRef.current.active = false; }
    };
    el.addEventListener('touchstart', onTS, { passive: false });
    el.addEventListener('touchmove', onTM, { passive: false });
    el.addEventListener('touchend', onTE);

    return () => {
      el.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      el.removeEventListener('wheel', onWh);
      el.removeEventListener('touchstart', onTS);
      el.removeEventListener('touchmove', onTM);
      el.removeEventListener('touchend', onTE);
    };
  }, [scheduleApply, clamp, applyTransform, flushZoom]);

  const doDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = pdfUrl; a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [pdfUrl, batchId]);

  const showToast = useCallback((icon: string, text: string) => {
    setToastMsg({ icon, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const doDownloadImage = useCallback(() => {
    const canvas = document.querySelector('.pv-pdf-wrap canvas') as HTMLCanvasElement;
    if (!canvas) { showToast('⚠️', 'PDF 未渲染'); return; }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `procurement_${batchId}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('🖼️', '图片已下载');
  }, [batchId, showToast]);

  const stepZoom = useCallback((delta: number) => {
    const g = gRef.current;
    g.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.scale + delta));
    if (g.scale <= 1) { g.tx = 0; g.ty = 0; }
    clamp(); applyTransform(true); flushZoom(true);
  }, [clamp, applyTransform, flushZoom]);

  const resetZoom = useCallback(() => {
    gRef.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform(true); flushZoom(true);
  }, [applyTransform, flushZoom]);

  return (
    <View style={st.container}>
      {createPortal(<div className={`pv-root${exiting ? ' out' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
        <style dangerouslySetInnerHTML={{ __html: getCSS(c) }} />

        {/* Navbar */}
        <div className="pv-nav">
          <div className="pv-nav-l">
            <div className="pv-back" onClick={handleBack}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></div>
            <div><div className="pv-title">{title}</div></div>
          </div>
          <div className="pv-share-btn" onClick={() => setShareOpen(true)}>
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
          </div>
        </div>

        {/* Page pill */}
        {numPages > 0 && <div className="pv-pill">第 {currentPage} 页 / 共 {numPages} 页</div>}

        {/* Zoom indicator */}
        <div className={`pv-zi${zoomVis ? ' on' : ''}`}>{zoomPct}%</div>

        {/* PDF Viewport */}
        <div className="pv-vp">
          {/* Mask — blocks interaction while PDF loads */}
          {pdfLoading && !pdfError && <div className="pv-loading-mask" />}
          {/* Intro elapsed toast — centered, shows while PDF loads */}
          {pdfLoading && !pdfError && (
            <div className="pv-intro-overlay">
              <div className="pv-intro on">
                <div className="pv-intro-text">{t('pdfGenerating')}</div>
                <div className="pv-intro-sec" style={{ color: c.accent }}>{introSec}</div>
              </div>
            </div>
          )}
          {pdfError && (
            <div className="pv-err" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                <circle cx="24" cy="24" r="20" stroke="#e0dcd5" strokeWidth="1.5" fill="#f5f2eb" />
                <line x1="24" y1="14" x2="24" y2="28" />
                <circle cx="24" cy="33" r="1.5" fill="#999" stroke="none" />
              </svg>
              <div>{t('pdfLoadFailed')}</div>
              <div className="pv-err-msg">{pdfError}</div>
              <button className="pv-err-btn" onClick={() => { setPdfError(''); setPdfLoading(true); setPdfBlobUrl(''); setIntroSec(1); }}>{t('retry')}</button>
            </div>
          )}
          <div className="pv-pdf-wrap" ref={wrapRef} style={{ visibility: pdfLoading ? 'hidden' : 'visible' }}>
            {pdfBlobUrl && (
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoading(false); }}
              onLoadError={(e) => { setPdfError(e?.message || 'PDF 解析失败'); setPdfLoading(false); }}
              loading={null}
            >
              {Array.from({ length: numPages || 1 }, (_, i) => i + 1).map(p => (
                <Page
                  key={p}
                  pageNumber={p}
                  width={pageW}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              ))}
            </Document>
            )}
          </div>
        </div>

        {/* Zoom buttons */}
        <div className="pv-zoom-strip">
          <div className="pv-zoom-btn" onClick={() => stepZoom(0.25)}><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></div>
          <div className="pv-zoom-btn" onClick={resetZoom}><svg viewBox="0 0 24 24"><path d="M3.5 3.5l4 4M20.5 3.5l-4 4M20.5 20.5l-4-4M3.5 20.5l4-4" /></svg></div>
          <div className="pv-zoom-btn" onClick={() => stepZoom(-0.25)}><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /></svg></div>
        </div>

        {/* Toast */}
        <div className={`pv-toast${toastMsg ? ' on' : ''}`}>{toastMsg && <><span>{toastMsg.icon}</span><span>{toastMsg.text}</span></>}</div>

        {/* Share sheet — warm-white background */}
        <div className={`pv-sh-overlay${shareOpen ? ' open' : ''}`} onClick={() => setShareOpen(false)}>
          <div className="pv-sh" onClick={e => e.stopPropagation()}>
            <div className="pv-sh-handle" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '0 8px' }}>
              {[
                ['微信', '#07c160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'],
                ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3'],
                ['下载图片', '#4a90d9', 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21'],
              ].map(([label, bg, path]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', cursor: 'pointer', borderRadius: 12 }}
                  onClick={() => {
                    setShareOpen(false);
                    if (label === '下载PDF') doDownload();
                    else if (label === '下载图片') doDownloadImage();
                    else showToast('📤', `已分享至 ${label}`);
                  }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#fff" strokeWidth="1.8" fill="none"><path d={path} /></svg>
                  </div>
                  <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>, document.body)}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
