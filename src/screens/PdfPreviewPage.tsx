import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

interface BatchItem {
  product_name: string;
  spec: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface BatchData {
  batch_number: number;
  date: string;
  payment_method: string;
  total: number;
  items: BatchItem[];
  operator?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const TOOLBAR_H = 72;

const CSS = `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{--bg:#141416;--surface:#1E1E22;--surface2:#26262C;--surface3:#2E2E36;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--text:#F0EDE8;--text2:rgba(240,237,232,.5);--text3:rgba(240,237,232,.28);--accent:#C0392B;--accent2:#8B2020;--accent-dim:rgba(192,57,43,.15);--sans:'Noto Sans SC',sans-serif;--mono:'DM Mono',monospace;--serif:'Lora',serif}
html.pv-lock{overflow:hidden;touch-action:none}

/* Navbar */
.pv-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(20,20,22,.85);backdrop-filter:blur(20px) saturate(1.5);border-bottom:1px solid var(--line)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-back{width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:var(--surface3)}
.pv-back svg{width:16px;height:16px;stroke:var(--text);stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:var(--text);letter-spacing:.01em}
.pv-sub{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:1px}

/* Page pill */
.pv-pill{position:fixed;top:68px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:20px;padding:4px 14px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;pointer-events:none}
/* Zoom indicator */
.pv-zi{position:fixed;top:68px;right:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:8px;padding:4px 10px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;opacity:0;transition:opacity .25s;pointer-events:none}
.pv-zi.on{opacity:1}

/* Viewport */
.pv-vp{position:fixed;inset:0;padding-top:56px;padding-bottom:${TOOLBAR_H}px;overflow:hidden;background:var(--bg)}
.pv-vp-inner{width:100%;height:100%;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;position:relative;cursor:grab}
.pv-vp-inner.grabbing{cursor:grabbing}

/* Document sheet */
.pv-sheet{position:absolute;transform-origin:center top;will-change:transform;padding:0 12px;top:12px;touch-action:none;user-select:none}
.pv-paper{background:#fff;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.3);overflow:hidden;width:340px;padding:0;font-family:'Noto Sans SC',sans-serif}
.pv-inner{border:1px solid #7D2329;padding:32px 36px 28px;min-height:256mm;box-sizing:border-box;position:relative}
.pv-co{text-align:center;margin-bottom:20px}
.pv-co-name{font-size:13px;font-weight:500;color:#2C2626;letter-spacing:3px}
.pv-co-sub{font-size:9px;color:#8C8583;letter-spacing:1px;margin-top:2px}
.pv-title-block{text-align:center;border-top:1px solid #7D2329;border-bottom:1px solid #7D2329;padding:12px 0;margin-bottom:24px}
.pv-title-block .t{font-size:20px;font-weight:700;color:#7D2329;letter-spacing:8px}
.pv-title-block .s{font-size:10px;color:#8C8583;letter-spacing:1px;margin-top:2px}
.pv-meta-row{display:flex;justify-content:space-between;margin-bottom:22px;font-size:11px;padding:0 4px;gap:12px}
.pv-meta-row>div{flex:1}
.pv-meta-row .lbl{color:#8C8583}
.pv-meta-row .val{font-weight:500}
.pv-table{width:100%;border-collapse:collapse;font-size:12px}
.pv-table thead th{background:#7D2329;color:#fff;font-weight:500;padding:10px 12px;text-align:center;font-size:11px;letter-spacing:1px}
.pv-table thead th:first-child{text-align:left;padding-left:16px}
.pv-table tbody td{padding:11px 12px;text-align:center;border-bottom:1px solid #EAE5E0}
.pv-table tbody td:first-child{text-align:left;padding-left:16px;font-weight:500}
.pv-table tbody td:last-child{font-weight:600}
.pv-table tbody tr:last-child td{border-bottom:2px solid #7D2329}
.pv-table .pv-total-row td{font-size:16px;font-weight:700;color:#7D2329;padding:16px 12px;border-bottom:none}
.pv-table .pv-total-row td:last-child{font-size:18px}
.pv-imgs{margin-top:28px;padding-top:16px;border-top:1px dashed #EAE5E0}
.pv-imgs-label{font-size:10px;color:#8C8583;letter-spacing:1px;margin-bottom:10px}
.pv-imgs-grid{display:flex;gap:8px;flex-wrap:wrap}
.pv-imgs-grid img{width:100px;height:75px;object-fit:cover;border-radius:3px}
.pv-divider{border-bottom:1px dashed #EAE5E0;margin:12px 0}
.pv-footer{margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#8C8583;position:relative}
.pv-footer .note{max-width:50%;line-height:1.6;font-size:10px}
.pv-footer .sigs{display:flex;gap:24px;font-size:12px;color:#2C2626;flex-shrink:0;white-space:nowrap;margin-left:auto}
.pv-footer .sigs span{font-weight:500}
.pv-seal{position:absolute;bottom:-8px;right:-16px;width:72px;height:72px;transform:rotate(-15deg);pointer-events:none}
.pv-seal-round{width:72px;height:72px;border-radius:50%;border:2.5px solid rgba(125,35,41,0.25);display:flex;align-items:center;justify-content:center;flex-direction:column;position:relative}
.pv-seal-text{font-family:'Noto Serif SC','Noto Sans SC',serif;font-size:15px;font-weight:700;color:rgba(125,35,41,0.35);letter-spacing:2px;line-height:1}
.pv-seal-sub{font-family:'Inter',sans-serif;font-size:6.5px;font-weight:600;color:rgba(125,35,41,0.2);letter-spacing:1px;margin-top:2px}

/* Toolbar */
.pv-tb{position:fixed;bottom:0;left:0;right:0;z-index:100;height:${TOOLBAR_H}px;background:rgba(20,20,22,.88);backdrop-filter:blur(20px) saturate(1.5);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding:0 8px 8px}
.pv-tb-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .15s;border:none;background:none;flex:1;max-width:90px}
.pv-tb-btn:active{background:var(--surface2);transform:scale(.95)}
.pv-tb-btn svg{width:20px;height:20px;stroke:var(--text2);stroke-width:1.7;fill:none}
.pv-tb-btn span{font-size:10px;color:var(--text3);font-family:var(--sans);white-space:nowrap}
.pv-tb-btn.hi svg{stroke:var(--accent)}
.pv-tb-btn.hi span{color:var(--accent)}
.pv-tb-sep{width:1px;height:36px;background:var(--line);flex-shrink:0}

/* Zoom strip */
.pv-zoom-strip{position:fixed;right:16px;bottom:${TOOLBAR_H + 18}px;z-index:95;display:flex;flex-direction:column;gap:6px}
.pv-zoom-btn{width:40px;height:40px;border-radius:50%;background:rgba(20,20,22,.75);backdrop-filter:blur(12px);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 12px rgba(0,0,0,.35)}
.pv-zoom-btn:active{background:var(--surface3);transform:scale(.92)}
.pv-zoom-btn svg{width:16px;height:16px;stroke:var(--text2);stroke-width:2;fill:none}

/* Toast */
.pv-toast{position:fixed;bottom:${TOOLBAR_H + 16}px;left:50%;transform:translate(-50%,8px);background:rgba(30,30,34,.95);backdrop-filter:blur(16px);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.pv-toast.on{opacity:1;transform:translate(-50%,0)}

/* Share sheet */
.pv-sh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;opacity:0;pointer-events:none;transition:opacity .25s}
.pv-sh-overlay.open{opacity:1;pointer-events:all}
.pv-sh{position:fixed;bottom:0;left:0;right:0;z-index:160;background:var(--surface);border-radius:20px 20px 0 0;padding:0 0 32px;transform:translateY(100%);transition:transform .3s cubic-bezier(.32,.72,0,1)}
.pv-sh-overlay.open .pv-sh{transform:none}
.pv-sh-handle{width:36px;height:4px;background:var(--line2);border-radius:2px;margin:12px auto 16px}
.pv-sh-title{font-size:13px;font-weight:600;color:var(--text2);text-align:center;margin-bottom:16px;letter-spacing:.04em}
.pv-sh-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:0 8px;margin-bottom:16px}
.pv-sh-act{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;cursor:pointer;border-radius:12px;transition:background .15s}
.pv-sh-act:active{background:var(--surface2)}
.pv-sh-icon{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.pv-sh-icon svg{width:22px;height:22px;stroke:#fff;stroke-width:1.8;fill:none}
.pv-sh-act span{font-size:11px;color:var(--text2)}
.pv-sh-cancel{margin:8px 16px 0;padding:14px;border-radius:14px;background:var(--surface2);border:1px solid var(--line2);text-align:center;font-size:14px;font-weight:500;color:var(--text2);cursor:pointer;transition:background .15s}
.pv-sh-cancel:active{background:var(--surface3)}

/* Loading */
.pv-loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:200}
.pv-spinner{width:32px;height:32px;border:3px solid var(--line2);border-top-color:var(--text2);border-radius:50%;animation:pv-spin .6s linear infinite}
@keyframes pv-spin{to{transform:rotate(360deg)}}
`;

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch { return dateStr; }
}

function fmtMoney(n: number): string {
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildDocHTML(b: BatchData): string {
  const now = new Date();
  const genDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const itemsRows = b.items.map(it =>
    `<tr><td>${escapeHtml(it.product_name)}</td><td>${escapeHtml(it.spec || '')}</td><td>${fmtMoney(it.unit_price)}</td><td>${it.quantity}</td><td>${fmtMoney(it.subtotal)}</td></tr>`
  ).join('');

  const paymentLabel = (b.payment_method === 'cash') ? '现金' : (b.payment_method === 'wechat' ? '微信' : (b.payment_method || '微信'));
  const noteRaw = '';
  const noteHtml = noteRaw ? `<div class="note">备注：${escapeHtml(noteRaw)}</div>` : '';

  return `<div class="pv-inner">
<div class="pv-co"><div class="pv-co-name">柳 味 探 秘 科 技</div><div class="pv-co-sub">LIUWEI TECHNOLOGY · 餐饮供应链管理</div></div>
<div class="pv-title-block"><div class="t">进 货 单</div><div class="s">PURCHASE ORDER / RECEIPT</div></div>
<div class="pv-meta-row">
  <div><span class="lbl">日期</span> <span class="val">${formatDate(b.date)}</span></div>
  <div><span class="lbl">支付</span> <span class="val">${paymentLabel}</span></div>
  <div><span class="lbl">类别</span> <span class="val">商品</span></div>
  <div><span class="lbl">批次</span> <span class="val">#${b.batch_number}</span></div>
</div>
<table class="pv-table">
<thead><tr><th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>小计</th></tr></thead>
<tbody>
${itemsRows}
<tr class="pv-total-row"><td colspan="4" style="text-align:right;padding-right:20px;">合计（人民币）</td><td>${fmtMoney(b.total)}</td></tr>
</tbody>
</table>
<div class="pv-divider"></div>
<div class="pv-footer">
  ${noteHtml}
  <div class="sigs"><span>操作员：${escapeHtml(b.operator || '')}</span><span>生成日期：${genDate}</span></div>
  <div class="pv-seal"><div class="pv-seal-round"><div class="pv-seal-text">柳味探秘</div><div class="pv-seal-sub">LIUWEI</div></div></div>
</div>
</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [zoomVis, setZoomVis] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ icon: string; text: string } | null>(null);

  const vpRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const touchRef = useRef({ mode: '' as '' | 'drag' | 'pinch', startX: 0, startY: 0, startTx: 0, startTy: 0, pinchDist: 0, pinchScale: 1, lastTap: 0 });
  const zoomTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf`;

  // Fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getProcurementBatchDetail(batchId);
        if (!cancelled) setBatch(data as any);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  // Lock body scroll
  useEffect(() => {
    document.documentElement.classList.add('pv-lock');
    return () => document.documentElement.classList.remove('pv-lock');
  }, []);

  // Init zoom
  const initZoom = useCallback(() => {
    const vp = vpRef.current;
    const s = sheetRef.current;
    if (!vp || !s) return;
    const paper = s.querySelector('.pv-paper') as HTMLElement;
    if (!paper) return;
    const vw = vp.clientWidth;
    const dw = paper.offsetWidth + 24;
    const fit = (vw - 24) / dw;
    setScale(Math.min(1, fit));
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => {
    if (batch && vpRef.current) {
      setTimeout(initZoom, 80);
    }
  }, [batch, initZoom]);

  // Apply transform
  const applyTransform = useCallback((s: number, x: number, y: number, ani: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = ani ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    el.style.transform = `translate(calc(-50% + ${x}px), ${y}px) scale(${s})`;
  }, []);

  const clamp = useCallback((s: number, x: number, y: number): [number, number, number] => {
    const vp = vpRef.current;
    const sh = sheetRef.current;
    if (!vp || !sh) return [s, x, y];
    const paper = sh.querySelector('.pv-paper') as HTMLElement;
    if (!paper) return [s, x, y];
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const dw = (paper.offsetWidth + 24) * s;
    const dh = (paper.offsetHeight + 24) * s;
    const maxTx = Math.max(0, (dw - vw) / 2);
    const maxTy = Math.max(0, (dh - vh) / 2 + 20);
    return [s, Math.max(-maxTx, Math.min(maxTx, x)), Math.max(-20, Math.min(maxTy, y))];
  }, []);

  const flashZoom = useCallback((s: number) => {
    setZoomVis(true);
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setZoomVis(false), 1500);
  }, []);

  // Gesture events
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    // Mouse
    const onMD = (e: MouseEvent) => {
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
      vp.classList.add('grabbing');
    };
    const onMM = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const d = dragRef.current;
      const nx = d.startTx + (e.clientX - d.startX);
      const ny = d.startTy + (e.clientY - d.startY);
      const [, cx, cy] = clamp(scale, nx, ny);
      setTx(cx); setTy(cy);
      applyTransform(scale, cx, cy, false);
    };
    const onMU = () => { dragRef.current.active = false; vp.classList.remove('grabbing'); };
    const onWh = (e: WheelEvent) => {
      e.preventDefault();
      const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
      const [cs, cx, cy] = clamp(ns, tx, ty);
      setScale(cs); setTx(cx); setTy(cy);
      applyTransform(cs, cx, cy, false);
      flashZoom(cs);
    };

    vp.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    vp.addEventListener('wheel', onWh, { passive: false });
    return () => {
      vp.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      vp.removeEventListener('wheel', onWh);
    };
  }, [scale, tx, ty, clamp, applyTransform, flashZoom]);

  // Touch events
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const tr = touchRef.current;
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - tr.lastTap < 300) {
          const ns = scale > 1.1 ? 1 : 2;
          const [cs, cx, cy] = clamp(ns, 0, 0);
          setScale(cs); setTx(cx); setTy(cy);
          applyTransform(cs, cx, cy, true);
          flashZoom(cs);
          tr.lastTap = 0;
          return;
        }
        tr.lastTap = now;
        tr.mode = 'drag';
        tr.startX = e.touches[0].clientX;
        tr.startY = e.touches[0].clientY;
        tr.startTx = tx;
        tr.startTy = ty;
        vp.classList.add('grabbing');
      } else if (e.touches.length === 2) {
        tr.mode = 'pinch';
        tr.pinchDist = dist(e.touches);
        tr.pinchScale = scale;
      }
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const tr = touchRef.current;
      if (tr.mode === 'drag' && e.touches.length === 1) {
        const nx = tr.startTx + (e.touches[0].clientX - tr.startX);
        const ny = tr.startTy + (e.touches[0].clientY - tr.startY);
        const [, cx, cy] = clamp(scale, nx, ny);
        setTx(cx); setTy(cy);
        applyTransform(scale, cx, cy, false);
      } else if (tr.mode === 'pinch' && e.touches.length === 2) {
        const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, tr.pinchScale * (dist(e.touches) / tr.pinchDist)));
        const [cs, cx, cy] = clamp(ns, tx, ty);
        setScale(cs); setTx(cx); setTy(cy);
        applyTransform(cs, cx, cy, false);
        flashZoom(cs);
      }
    };

    const onTE = (e: TouchEvent) => {
      const tr = touchRef.current;
      if (e.touches.length === 0) { tr.mode = ''; vp.classList.remove('grabbing'); }
      else if (e.touches.length === 1 && tr.mode === 'pinch') {
        tr.mode = 'drag';
        tr.startX = e.touches[0].clientX;
        tr.startY = e.touches[0].clientY;
        tr.startTx = tx;
        tr.startTy = ty;
      }
    };

    vp.addEventListener('touchstart', onTS, { passive: false });
    vp.addEventListener('touchmove', onTM, { passive: false });
    vp.addEventListener('touchend', onTE);
    return () => {
      vp.removeEventListener('touchstart', onTS);
      vp.removeEventListener('touchmove', onTM);
      vp.removeEventListener('touchend', onTE);
    };
  }, [scale, tx, ty, clamp, applyTransform, flashZoom]);

  // Toast
  const showToast = useCallback((icon: string, text: string) => {
    setToastMsg({ icon, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const doDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfUrl, batchId]);

  const doCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast('🔗', '链接已复制');
  }, [showToast]);

  const zoomBy = useCallback((delta: number) => {
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
    const [cs, cx, cy] = clamp(ns, tx, ty);
    setScale(cs); setTx(cx); setTy(cy);
    applyTransform(cs, cx, cy, true);
    flashZoom(cs);
  }, [scale, tx, ty, clamp, applyTransform, flashZoom]);

  const resetZoom = useCallback(() => {
    const [cs, cx, cy] = clamp(1, 0, 0);
    setScale(cs); setTx(cx); setTy(cy);
    applyTransform(cs, cx, cy, true);
    flashZoom(cs);
  }, [clamp, applyTransform, flashZoom]);

  // Re-apply on resize
  useEffect(() => {
    const onResize = () => {
      const [cs, cx, cy] = clamp(scale, tx, ty);
      setTx(cx); setTy(cy);
      applyTransform(cs || scale, cx, cy, false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scale, tx, ty, clamp, applyTransform]);

  const docHtml = useMemo(() => batch ? buildDocHTML(batch) : '', [batch]);

  return (
    <View style={styles.container}>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <style dangerouslySetInnerHTML={{ __html: CSS }} />

          {/* Loading */}
          {loading && (
            <div className="pv-loading">
              <div className="pv-spinner" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="pv-loading" style={{ flexDirection: 'column', gap: 12 }}>
              <div style={{ color: 'var(--text2)', fontSize: 14 }}>{error}</div>
              <button onClick={onBack} style={{ color: 'var(--accent)', background: 'none', border: '1px solid var(--line2)', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>返回</button>
            </div>
          )}

          {batch && (
            <>
              {/* Navbar */}
              <div className="pv-nav">
                <div className="pv-nav-l">
                  <div className="pv-back" onClick={onBack}>
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                  </div>
                  <div>
                    <div className="pv-title">{title}</div>
                    <div className="pv-sub">NO.2026-{String(batch.batch_number).padStart(4, '0')} · {formatDate(batch.date)}</div>
                  </div>
                </div>
              </div>

              {/* Page pill */}
              <div className="pv-pill">第 1 页 / 共 1 页</div>

              {/* Zoom indicator */}
              <div className={`pv-zi${zoomVis ? ' on' : ''}`}>{Math.round(scale * 100)}%</div>

              {/* Viewport */}
              <div className="pv-vp">
                <div className="pv-vp-inner" ref={vpRef}>
                  <div className="pv-sheet" ref={sheetRef}>
                    <div className="pv-paper" dangerouslySetInnerHTML={{ __html: docHtml }} />
                  </div>
                </div>
              </div>

              {/* Zoom buttons */}
              <div className="pv-zoom-strip">
                <div className="pv-zoom-btn" onClick={() => zoomBy(0.25)}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <div className="pv-zoom-btn" onClick={resetZoom}>
                  <svg viewBox="0 0 24 24"><path d="M3.5 3.5l4 4M20.5 3.5l-4 4M20.5 20.5l-4-4M3.5 20.5l4-4" /></svg>
                </div>
                <div className="pv-zoom-btn" onClick={() => zoomBy(-0.25)}>
                  <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
              </div>

              {/* Toolbar */}
              <div className="pv-tb">
                <button className="pv-tb-btn" onClick={doDownload}>
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  <span>下载</span>
                </button>
                <div className="pv-tb-sep" />
                <button className="pv-tb-btn" onClick={() => setShareOpen(true)}>
                  <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                  <span>分享</span>
                </button>
                <div className="pv-tb-sep" />
                <button className="pv-tb-btn" onClick={doCopyLink}>
                  <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                  <span>复制链接</span>
                </button>
                <div className="pv-tb-sep" />
                <button className="pv-tb-btn hi" onClick={() => window.print()}>
                  <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  <span>打印</span>
                </button>
              </div>

              {/* Toast */}
              <div className={`pv-toast${toastMsg ? ' on' : ''}`}>
                {toastMsg && <><span>{toastMsg.icon}</span><span>{toastMsg.text}</span></>}
              </div>

              {/* Share sheet */}
              <div className={`pv-sh-overlay${shareOpen ? ' open' : ''}`} onClick={() => setShareOpen(false)}>
                <div className="pv-sh" onClick={e => e.stopPropagation()}>
                  <div className="pv-sh-handle" />
                  <div className="pv-sh-title">分享进货单</div>
                  <div className="pv-sh-acts">
                    {[
                      ['微信', '#07c160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                      ['朋友圈', '#fa9d3b', 'M12 2a10 10 0 100 20 10 10 0 000-20z M7 6.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5-1 2.5-2.5 2.5S7 8 7 6.5z M6 14c1.5-2 4-3 7-3s5.5 1 7 3'],
                      ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
                      ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'],
                      ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3'],
                      ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
                      ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
                    ].map(([label, color, path]) => (
                      <div key={label} className="pv-sh-act" onClick={() => { setShareOpen(false); showToast('📤', `已分享至 ${label}`); }}>
                        <div className="pv-sh-icon" style={{ background: color }}>
                          <svg viewBox="0 0 24 24"><path d={path} /></svg>
                        </div>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pv-sh-cancel" onClick={() => setShareOpen(false)}>取消</div>
                </div>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
