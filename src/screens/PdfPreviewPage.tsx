import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const TOOLBAR_H = 72;
const NAV_H = 56;

const CSS = `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{--bg:#141416;--surface:#1E1E22;--surface2:#26262C;--surface3:#2E2E36;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--text:#F0EDE8;--text2:rgba(240,237,232,.5);--text3:rgba(240,237,232,.28);--accent:#C0392B;--accent-dim:rgba(192,57,43,.15);--sans:'Noto Sans SC',sans-serif;--mono:'DM Mono',monospace}
html.pv-lock{overflow:hidden;touch-action:none}
.pv-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;padding:0 16px;background:rgba(20,20,22,.85);backdrop-filter:blur(20px) saturate(1.5);border-bottom:1px solid var(--line)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-back{width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:var(--surface3)}
.pv-back svg{width:16px;height:16px;stroke:var(--text);stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:var(--text);letter-spacing:.01em}
.pv-sub{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:1px}
.pv-pill{position:fixed;top:${NAV_H + 12}px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:20px;padding:4px 14px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;pointer-events:none}
.pv-zi{position:fixed;top:${NAV_H + 12}px;right:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:8px;padding:4px 10px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;opacity:0;transition:opacity .25s;pointer-events:none}
.pv-zi.on{opacity:1}
.pv-vp{position:fixed;top:${NAV_H}px;left:0;right:0;bottom:${TOOLBAR_H}px;overflow:hidden;background:#fff}
.pv-pdf-wrap{position:absolute;top:0;left:50%;transform-origin:center top;will-change:transform;touch-action:none;user-select:none;display:flex;flex-direction:column;align-items:center}
.pv-pdf-wrap canvas{display:block;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.12);border-radius:2px}
.pv-pdf-wrap .react-pdf__Page{margin-bottom:12px}
.pv-tb{position:fixed;bottom:0;left:0;right:0;z-index:100;height:${TOOLBAR_H}px;background:rgba(20,20,22,.88);backdrop-filter:blur(20px) saturate(1.5);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding:0 8px 8px}
.pv-tb-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .15s;border:none;background:none;flex:1;max-width:90px}
.pv-tb-btn:active{background:var(--surface2);transform:scale(.95)}
.pv-tb-btn svg{width:20px;height:20px;stroke:var(--text2);stroke-width:1.7;fill:none}
.pv-tb-btn span{font-size:10px;color:var(--text3);font-family:var(--sans);white-space:nowrap}
.pv-tb-btn.hi svg{stroke:var(--accent)}
.pv-tb-btn.hi span{color:var(--accent)}
.pv-tb-sep{width:1px;height:36px;background:var(--line);flex-shrink:0}
.pv-zoom-strip{position:fixed;right:16px;bottom:${TOOLBAR_H + 18}px;z-index:95;display:flex;flex-direction:column;gap:6px}
.pv-zoom-btn{width:40px;height:40px;border-radius:50%;background:rgba(20,20,22,.75);backdrop-filter:blur(12px);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 12px rgba(0,0,0,.35)}
.pv-zoom-btn:active{background:var(--surface3);transform:scale(.92)}
.pv-zoom-btn svg{width:16px;height:16px;stroke:var(--text2);stroke-width:2;fill:none}
.pv-toast{position:fixed;bottom:${TOOLBAR_H + 16}px;left:50%;transform:translate(-50%,8px);background:rgba(30,30,34,.95);backdrop-filter:blur(16px);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.pv-toast.on{opacity:1;transform:translate(-50%,0)}
.pv-loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:200}
.pv-spinner{width:32px;height:32px;border:3px solid var(--line2);border-top-color:var(--text2);border-radius:50%;animation:pv-spin .6s linear infinite}
@keyframes pv-spin{to{transform:rotate(360deg)}}
.pv-sh-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .25s}
.pv-sh-overlay.open{opacity:1;pointer-events:auto}
.pv-sh{position:absolute;bottom:0;left:0;right:0;max-height:70vh;background:var(--surface);border-radius:20px 20px 0 0;padding:16px 16px 24px;transform:translateY(20px);transition:transform .3s cubic-bezier(.4,0,.2,1)}
.pv-sh-overlay.open .pv-sh{transform:translateY(0)}
.pv-sh-handle{width:36px;height:4px;background:var(--line2);border-radius:2px;margin:0 auto 16px}
.pv-err{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text2);font-size:14px;text-align:center;padding:40px}
.pv-err-btn{padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;font-size:13px;cursor:pointer}
`;

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

  // Fetch PDF as blob with auth cookies, then create object URL for react-pdf
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log('[pdf] fetching:', pdfUrl);
        const res = await fetch(pdfUrl, { credentials: 'include' });
        console.log('[pdf] response:', res.status, res.statusText, 'type:', res.headers.get('content-type'), 'len:', res.headers.get('content-length'));
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        console.log('[pdf] blob size:', blob.size, 'type:', blob.type);
        if (blob.size === 0) throw new Error('Empty PDF (0 bytes)');
        if (!cancelled) { setPdfBlobUrl(URL.createObjectURL(blob)); console.log('[pdf] blob URL created'); }
      } catch (e: any) {
        console.error('[pdf] fetch error:', e?.message || e);
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
  const velRef = useRef({ vx: 0, vy: 0, px: 0, py: 0, pt: 0 });
  const inertiaRef = useRef(0);
  const rafRef = useRef(0);
  const ziTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { document.documentElement.classList.add('pv-lock'); return () => document.documentElement.classList.remove('pv-lock'); }, []);

  const applyTransform = useCallback((animated: boolean) => {
    const el = wrapRef.current; if (!el) return;
    const g = gRef.current;
    el.style.transition = animated ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    el.style.transform = `translate(-50%, 0) translate(${g.tx}px, ${g.ty}px) scale(${g.scale})`;
    if (animated) setTimeout(() => { if (el) el.style.transition = 'none'; }, 260);
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
    const my = Math.max(0, (ch - vh) / 2 + 20);
    g.tx = Math.max(-mx, Math.min(mx, g.tx));
    g.ty = Math.max(-20, Math.min(my, g.ty));
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRef.current) { cancelAnimationFrame(inertiaRef.current); inertiaRef.current = 0; }
  }, []);

  const startInertia = useCallback(() => {
    stopInertia();
    const FRICTION = 0.92;
    const THRESHOLD = 0.5;
    const tick = () => {
      const v = velRef.current;
      v.vx *= FRICTION;
      v.vy *= FRICTION;
      if (Math.abs(v.vx) < THRESHOLD && Math.abs(v.vy) < THRESHOLD) {
        clamp(); applyTransform(true);
        return;
      }
      gRef.current.tx -= v.vx;
      gRef.current.ty -= v.vy;
      applyTransform(false);
      inertiaRef.current = requestAnimationFrame(tick);
    };
    inertiaRef.current = requestAnimationFrame(tick);
  }, [stopInertia, clamp, applyTransform]);

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

  // ── 手势事件 ──
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;

    const trackVel = (x: number, y: number) => {
      const now = performance.now();
      const v = velRef.current;
      if (v.pt > 0) {
        const dt = now - v.pt;
        v.vx = dt > 0 ? ((x - v.px) / dt) * 16 : 0;
        v.vy = dt > 0 ? ((y - v.py) / dt) * 16 : 0;
      }
      v.px = x; v.py = y; v.pt = now;
    };

    const onMD = (e: MouseEvent) => {
      e.preventDefault();
      stopInertia();
      const g = gRef.current;
      dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, stx: g.tx, sty: g.ty };
      velRef.current = { vx: 0, vy: 0, px: e.clientX, py: e.clientY, pt: performance.now() };
    };
    const onMM = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const d = dragRef.current;
      trackVel(e.clientX, e.clientY);
      gRef.current.tx = d.stx + (e.clientX - d.sx);
      gRef.current.ty = d.sty + (e.clientY - d.sy);
      scheduleApply();
    };
    const onMU = () => { dragRef.current.active = false; startInertia(); };
    const onWh = (e: WheelEvent) => {
      e.preventDefault();
      const g = gRef.current;
      g.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.scale + (e.deltaY > 0 ? -0.08 : 0.08)));
      clamp(); applyTransform(false); flushZoom(false);
    };

    el.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    el.addEventListener('wheel', onWh, { passive: false });

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      stopInertia();
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          const ns = gRef.current.scale > 1.1 ? 1 : 2;
          gRef.current.scale = ns; gRef.current.tx = 0; gRef.current.ty = 0;
          clamp(); applyTransform(true); flushZoom(true); lastTapRef.current = 0; return;
        }
        lastTapRef.current = now;
        dragRef.current = { active: true, sx: e.touches[0].clientX, sy: e.touches[0].clientY, stx: gRef.current.tx, sty: gRef.current.ty };
        velRef.current = { vx: 0, vy: 0, px: e.touches[0].clientX, py: e.touches[0].clientY, pt: performance.now() };
      } else if (e.touches.length === 2) {
        pinchRef.current = { dist: dist(e.touches), scale: gRef.current.scale };
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (dragRef.current.active && e.touches.length === 1) {
        const d = dragRef.current;
        trackVel(e.touches[0].clientX, e.touches[0].clientY);
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
      if (e.touches.length === 0) { dragRef.current.active = false; startInertia(); }
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
  }, [scheduleApply, clamp, applyTransform, flushZoom, stopInertia, startInertia]);

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

  const doCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast('🔗', '链接已复制');
  }, [showToast]);

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
      {createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />

        {/* Navbar */}
        <div className="pv-nav"><div className="pv-nav-l">
          <div className="pv-back" onClick={onBack}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></div>
          <div><div className="pv-title">{title}</div><div className="pv-sub">NO.2026-{String(batchNumber).padStart(4, '0')}</div></div>
        </div></div>

        {/* Page pill */}
        {numPages > 0 && <div className="pv-pill">第 1 页 / 共 {numPages} 页</div>}

        {/* Zoom indicator */}
        <div className={`pv-zi${zoomVis ? ' on' : ''}`}>{zoomPct}%</div>

        {/* PDF Viewport */}
        <div className="pv-vp">
          {pdfLoading && !pdfError && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              <div className="pv-spinner" />
            </div>
          )}
          {pdfError && (
            <div className="pv-err" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              <div>⚠️ PDF 加载失败</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pdfError}</div>
              <button className="pv-err-btn" onClick={() => { setPdfError(''); setPdfLoading(true); setPdfBlobUrl(''); }}>重试</button>
            </div>
          )}
          <div className="pv-pdf-wrap" ref={wrapRef} style={{ visibility: pdfLoading ? 'hidden' : 'visible' }}>
            {pdfBlobUrl && (
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoading(false); console.log('[pdf] loaded, pages:', n); }}
              onLoadError={(e) => { console.error('[pdf] Document onLoadError:', e); setPdfError(e?.message || 'PDF 解析失败'); setPdfLoading(false); }}
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

        {/* Toolbar */}
        <div className="pv-tb">
          <button className="pv-tb-btn" onClick={doDownload}><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg><span>下载</span></button>
          <div className="pv-tb-sep" />
          <button className="pv-tb-btn" onClick={() => setShareOpen(true)}><svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg><span>分享</span></button>
          <div className="pv-tb-sep" />
          <button className="pv-tb-btn" onClick={doCopyLink}><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg><span>复制链接</span></button>
          <div className="pv-tb-sep" />
          <button className="pv-tb-btn hi" onClick={() => window.print()}><svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg><span>打印</span></button>
        </div>

        {/* Toast */}
        <div className={`pv-toast${toastMsg ? ' on' : ''}`}>{toastMsg && <><span>{toastMsg.icon}</span><span>{toastMsg.text}</span></>}</div>

        {/* Share sheet */}
        <div className={`pv-sh-overlay${shareOpen ? ' open' : ''}`} onClick={() => setShareOpen(false)}>
          <div className="pv-sh" onClick={e => e.stopPropagation()}>
            <div className="pv-sh-handle" /><div className="pv-sh-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textAlign: 'center', marginBottom: 16, letterSpacing: '.04em' }}>分享进货单</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '0 8px', marginBottom: 16 }}>
              {[
                ['微信', '#07c160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                ['朋友圈', '#fa9d3b', 'M12 2a10 10 0 100 20 10 10 0 000-20z M7 6.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5-1 2.5-2.5 2.5S7 8 7 6.5z M6 14c1.5-2 4-3 7-3s5.5 1 7 3'],
                ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
                ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'],
                ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3'],
                ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
                ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
              ].map(([label, bg, path]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', cursor: 'pointer', borderRadius: 12 }}
                  onClick={() => { setShareOpen(false); showToast('📤', `已分享至 ${label}`); }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#fff" strokeWidth="1.8" fill="none"><path d={path} /></svg>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ margin: '8px 16px 0', padding: 14, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--line2)', textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text2)', cursor: 'pointer' }}
              onClick={() => setShareOpen(false)}>取消</div>
          </div>
        </div>
      </div>, document.body)}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
