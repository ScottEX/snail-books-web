import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';
import { historyHeader } from '../sharedStyles';

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */
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
  id: number;
  batch_number: number;
  date: string;
  payment_method: string;
  category: string;
  total: number;
  images: string[];
  note: string;
  items: BatchItem[];
}

/* ══════════════════════════════════════════════
   Icons
   ══════════════════════════════════════════════ */
function DownloadSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

function ShareSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <Path d="M16 6l-4-4-4 4" />
      <Line x1="12" y1="2" x2="12" y2="15" />
    </Svg>
  );
}

function LinkSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </Svg>
  );
}

function PrinterSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9V2h12v7" />
      <Path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <Rect x="6" y="14" width="12" height="8" />
    </Svg>
  );
}

function ZoomInSvg({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

function ZoomOutSvg({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

function ZoomResetSvg({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M3.5 3.5l4 4M20.5 3.5l-4 4M20.5 20.5l-4-4M3.5 20.5l4-4" />
    </Svg>
  );
}

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function fmtAmt(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function padBatch(n: number): string {
  return String(n).padStart(4, '0');
}

function formatBatchNumber(n: number): string {
  // Server generates batch_number as sequential integer
  return `2026-${padBatch(n)}`;
}

function getPaymentLabel(method: string): string {
  const map: Record<string, string> = {
    payCash: '现金', payWechat: '微信', payAlipay: '支付宝',
  };
  return map[method] || method;
}

/* ══════════════════════════════════════════════
   Document Renderer — builds inner HTML
   ══════════════════════════════════════════════ */
function buildDocHTML(batch: BatchData): string {
  const itemsHTML = batch.items.map(it => `
    <tr>
      <td>${esc(it.product_name)}</td>
      <td>${esc(it.spec || '—')}</td>
      <td>¥${fmtAmt(it.unit_price)}</td>
      <td>${it.quantity}</td>
      <td>¥${fmtAmt(it.subtotal)}</td>
    </tr>`).join('');

  const totalQty = batch.items.reduce((s, it) => s + it.quantity, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Noto Sans SC','PingFang SC',sans-serif;color:#222;line-height:1.5}
.doc-paper{background:#fff;width:340px;padding:28px 24px 36px}
.doc-brand{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e4de}
.doc-brand-name{font-size:13px;letter-spacing:.35em;color:#333;font-weight:500;margin-bottom:3px}
.doc-brand-sub{font-size:9px;letter-spacing:.18em;color:#aaa;font-family:monospace}
.doc-heading{text-align:center;margin-bottom:18px}
.doc-heading h1{font-size:22px;font-weight:700;letter-spacing:.3em;color:#C0392B;margin-bottom:3px}
.doc-heading p{font-size:8px;letter-spacing:.15em;color:#aaa;font-family:monospace}
.doc-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;font-size:10px;margin-bottom:16px;padding:10px 0;border-top:1px solid #e8e4de;border-bottom:1px solid #e8e4de}
.doc-meta-label{color:#aaa;margin-bottom:2px;font-family:monospace;font-size:8px;letter-spacing:.05em}
.doc-meta-value{color:#222;font-weight:500;font-size:10px}
.doc-table{width:100%;border-collapse:collapse;font-size:9.5px}
.doc-table th{background:#7a1a1a;color:#fff;padding:7px 6px;text-align:left;font-weight:500}
.doc-table th:last-child{text-align:right}
.doc-table th:nth-child(3),.doc-table th:nth-child(4){text-align:center}
.doc-table td{padding:7px 6px;border-bottom:1px solid #f0ece6;color:#222;vertical-align:middle}
.doc-table td:last-child{text-align:right;font-weight:600;color:#7a1a1a;font-family:monospace}
.doc-table td:nth-child(3){text-align:center;font-family:monospace;color:#555}
.doc-table td:nth-child(4){text-align:center;font-family:monospace;color:#333}
.doc-table tr:nth-child(even) td{background:#faf9f7}
.doc-totals{margin-top:16px;padding-top:12px;border-top:2px solid #e8e4de}
.doc-total-row{display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-bottom:5px}
.doc-total-row span:first-child{color:#888}
.doc-total-row span:last-child{font-family:monospace;color:#333}
.grand{margin-top:8px;padding-top:8px;border-top:1px solid #e8e4de}
.grand span:first-child{font-size:12px;font-weight:600;color:#222}
.grand span:last-child{font-size:16px;font-weight:700;color:#7a1a1a;font-family:monospace}
.doc-footer{margin-top:24px;text-align:center;padding-top:14px;border-top:1px solid #ede9e3}
.doc-footer p{font-size:8px;color:#bbb;letter-spacing:.08em;font-family:monospace;line-height:1.8}
</style></head><body><div class="doc-paper">
<div class="doc-brand"><div class="doc-brand-name">柳 味 探 秘 科 技</div><div class="doc-brand-sub">LIUWEI TECHNOLOGY · 餐饮供应链管理</div></div>
<div class="doc-heading"><h1>进 货 单</h1><p>PURCHASE ORDER / RECEIPT</p></div>
<div class="doc-meta">
  <div><div class="doc-meta-label">NO.</div><div class="doc-meta-value">${formatBatchNumber(batch.batch_number)}</div></div>
  <div><div class="doc-meta-label">日期</div><div class="doc-meta-value">${fmtDate(batch.date)}</div></div>
  <div><div class="doc-meta-label">支付</div><div class="doc-meta-value">${getPaymentLabel(batch.payment_method)}</div></div>
</div>
<table class="doc-table"><thead><tr><th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>${itemsHTML}</tbody></table>
<div class="doc-totals">
  <div class="doc-total-row"><span>商品种类</span><span>${batch.items.length} 种</span></div>
  <div class="doc-total-row"><span>总件数</span><span>${totalQty} 件</span></div>
  <div class="doc-total-row grand"><span>合计货款</span><span>¥${fmtAmt(batch.total)}</span></div>
</div>
<div class="doc-footer"><p>柳味探秘科技 · 餐饮供应链管理系统<br>本单据由系统自动生成</p></div>
</div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════ */
export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [zoomPct, setZoomPct] = useState(100);

  // ── Zoom / Pan state (via refs for perf) ──
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // ── Load data ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [detail, share] = await Promise.all([
          api.getProcurementBatchDetail(batchId) as Promise<BatchData>,
          api.getProcurementShareLink(batchId) as Promise<{ url: string }>,
        ]);
        if (cancelled) return;
        if (detail && detail.items) {
          setBatch(detail);
          setTokenUrl(share?.url || null);
        } else {
          setError('加载失败');
        }
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || '加载失败'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const publicUrl = tokenUrl
    ? (typeof window !== 'undefined' ? window.location.origin + tokenUrl : tokenUrl)
    : '';

  // ── Zoom helpers ──
  const applyTransform = useCallback((animated: boolean) => {
    const s = sheetRef.current;
    if (!s) return;
    s.style.transition = animated ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    s.style.transform = `translate(calc(-50% + ${txRef.current}px), ${tyRef.current}px) scale(${scaleRef.current})`;
    setZoomPct(Math.round(scaleRef.current * 100));
  }, []);

  const clampTranslation = useCallback(() => {
    const vp = viewportRef.current;
    const s = sheetRef.current;
    if (!vp || !s) return;
    const paper = s.querySelector('.doc-paper') as HTMLElement;
    if (!paper) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const dw = (paper.offsetWidth + 24) * scaleRef.current;
    const dh = (paper.offsetHeight + 24) * scaleRef.current;
    const maxTx = Math.max(0, (dw - vw) / 2);
    const maxTy = Math.max(0, (dh - vh) / 2 + 20);
    txRef.current = Math.max(-maxTx, Math.min(maxTx, txRef.current));
    tyRef.current = Math.max(-20, Math.min(maxTy, tyRef.current));
  }, []);

  const initZoom = useCallback(() => {
    const vp = viewportRef.current;
    const s = sheetRef.current;
    if (!vp || !s) return;
    const paper = s.querySelector('.doc-paper') as HTMLElement;
    if (!paper) return;
    const vw = vp.clientWidth;
    const docW = paper.offsetWidth + 24;
    const fit = (vw - 24) / docW;
    scaleRef.current = Math.min(1, fit);
    txRef.current = 0;
    tyRef.current = 0;
    applyTransform(false);
  }, [applyTransform]);

  // ── Mouse drag ──
  const dragRef = useRef({ active: false, sx: 0, sy: 0, stx: 0, sty: 0 });
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onMDown = (e: MouseEvent) => {
      dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, stx: txRef.current, sty: tyRef.current };
    };
    const onMMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      txRef.current = dragRef.current.stx + (e.clientX - dragRef.current.sx);
      tyRef.current = dragRef.current.sty + (e.clientY - dragRef.current.sy);
      clampTranslation();
      applyTransform(false);
    };
    const onMUp = () => { dragRef.current.active = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scaleRef.current = Math.max(0.5, Math.min(4, scaleRef.current + delta));
      clampTranslation();
      applyTransform(false);
    };

    vp.addEventListener('mousedown', onMDown);
    window.addEventListener('mousemove', onMMove);
    window.addEventListener('mouseup', onMUp);
    vp.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      vp.removeEventListener('mousedown', onMDown);
      window.removeEventListener('mousemove', onMMove);
      window.removeEventListener('mouseup', onMUp);
      vp.removeEventListener('wheel', onWheel);
    };
  }, [applyTransform, clampTranslation]);

  // ── Touch pinch/drag ──
  const touchRef = useRef({ mode: 'none' as 'none' | 'drag' | 'pinch', sx: 0, sy: 0, stx: 0, sty: 0, pd: 0, ps: 1, lastTap: 0 });
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const getDist = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);

    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const t = touchRef.current;
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - t.lastTap < 300) {
          if (scaleRef.current > 1.1) { scaleRef.current = 1; txRef.current = 0; tyRef.current = 0; }
          else { scaleRef.current = 2; }
          clampTranslation(); applyTransform(true);
          t.lastTap = 0; return;
        }
        t.lastTap = now;
        t.mode = 'drag';
        t.sx = e.touches[0].clientX; t.sy = e.touches[0].clientY;
        t.stx = txRef.current; t.sty = tyRef.current;
      } else if (e.touches.length === 2) {
        t.mode = 'pinch';
        t.pd = getDist(e.touches);
        t.ps = scaleRef.current;
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const t = touchRef.current;
      if (t.mode === 'drag' && e.touches.length === 1) {
        txRef.current = t.stx + (e.touches[0].clientX - t.sx);
        tyRef.current = t.sty + (e.touches[0].clientY - t.sy);
        clampTranslation(); applyTransform(false);
      } else if (t.mode === 'pinch' && e.touches.length === 2) {
        const d = getDist(e.touches);
        scaleRef.current = Math.max(0.5, Math.min(4, t.ps * (d / t.pd)));
        clampTranslation(); applyTransform(false);
      }
    };
    const onTE = (e: TouchEvent) => {
      const t = touchRef.current;
      if (e.touches.length === 0) { t.mode = 'none'; }
      else if (e.touches.length === 1 && t.mode === 'pinch') {
        t.mode = 'drag';
        t.sx = e.touches[0].clientX; t.sy = e.touches[0].clientY;
        t.stx = txRef.current; t.sty = tyRef.current;
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
  }, [applyTransform, clampTranslation]);

  // Init zoom on data load + resize
  useEffect(() => {
    if (!batch) return;
    const timer = setTimeout(initZoom, 100);
    const onResize = () => { clampTranslation(); applyTransform(false); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(timer); };
  }, [batch, initZoom, clampTranslation, applyTransform]);

  // ── Actions ──
  const doDownload = useCallback(async () => {
    if (!tokenUrl) return;
    showToast('⬇️ PDF 下载中…');
    try {
      const r = await fetch(tokenUrl);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `procurement_${batchId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { showToast('下载失败'); }
    setShareSheetOpen(false);
  }, [tokenUrl, batchId, showToast]);

  const copyLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(publicUrl); }
    catch { /* ignore */ }
    showToast('链接已复制');
  }, [publicUrl, showToast]);

  const stepZoom = useCallback((delta: number) => {
    scaleRef.current = Math.max(0.5, Math.min(4, scaleRef.current + delta));
    clampTranslation();
    applyTransform(true);
  }, [applyTransform, clampTranslation]);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1; txRef.current = 0; tyRef.current = 0;
    applyTransform(true);
  }, [applyTransform]);

  // ── Render ──
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={styles.backBtn}><BackArrow color={c.textMain} /></View>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {t('procPdfTitle').replace('{n}', String(batchNumber))}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={styles.hintText}>{t('pdfLoading')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={styles.backBtn}><BackArrow color={c.textMain} /></View>
          </TouchableOpacity>
          <Text style={styles.title}>{t('pdfLoadFailed')}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onBack} style={styles.retryBtn} activeOpacity={0.7}>
            <Text style={styles.retryText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const docHTML = batch ? buildDocHTML(batch) : '';

  return (
    <View style={styles.container}>
      {/* ══════ 标题栏（保持不变） ══════ */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}><BackArrow color={c.textMain} /></View>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {t('procPdfTitle').replace('{n}', String(batchNumber))}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ══════ 缩放百分比 ══════ */}
      <View style={styles.zoomPill} pointerEvents="none">
        <Text style={styles.zoomPillText}>{zoomPct}%</Text>
      </View>

      {/* ══════ 缩放按钮 ══════ */}
      <View style={styles.zoomBtns}>
        <TouchableOpacity onPress={() => stepZoom(0.25)} style={styles.zoomBtn} activeOpacity={0.7}>
          <ZoomInSvg color={c.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={resetZoom} style={styles.zoomBtn} activeOpacity={0.7}>
          <ZoomResetSvg color={c.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => stepZoom(-0.25)} style={styles.zoomBtn} activeOpacity={0.7}>
          <ZoomOutSvg color={c.textSub} />
        </TouchableOpacity>
      </View>

      {/* ══════ 文档视口 ══════ */}
      <View
        style={styles.viewport as any}
        // @ts-ignore
        ref={(el: HTMLDivElement | null) => { viewportRef.current = el; }}
      >
        <div
          ref={(el: HTMLDivElement | null) => { sheetRef.current = el; }}
          style={{
            position: 'absolute',
            left: '50%',
            top: 12,
            transformOrigin: 'center top',
            transform: `translate(-50%, 0) scale(1)`,
            padding: '0 12px',
            userSelect: 'none',
            touchAction: 'none',
            borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
            lineHeight: 0,
          }}
          dangerouslySetInnerHTML={{ __html: docHTML }}
        />
      </View>

      {/* ══════ 底部工具栏 ══════ */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={doDownload} activeOpacity={0.7}>
          <DownloadSvg color={c.textSub} />
          <Text style={styles.toolLabel}>{t('downloadPdf')}</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShareSheetOpen(true)} activeOpacity={0.7}>
          <ShareSvg color={c.textSub} />
          <Text style={styles.toolLabel}>{t('share')}</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={copyLink} activeOpacity={0.7}>
          <LinkSvg color={c.textSub} />
          <Text style={styles.toolLabel}>{t('linkCopied').replace('链接已复制', '复制链接')}</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => window.print()} activeOpacity={0.7}>
          <PrinterSvg color={c.primary} />
          <Text style={[styles.toolLabel, { color: c.primary }]}>{t('stampPrefixBurgundy').slice(0, 2)}打印</Text>
        </TouchableOpacity>
      </View>

      {/* ══════ 分享面板 ══════ */}
      {shareSheetOpen && (
        <View style={styles.sheetOverlay as any}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareSheetOpen(false)} />
          <View style={styles.sheet as any}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>分享进货单</Text>
            <View style={styles.sheetGrid}>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { setShareSheetOpen(false); showToast('已分享'); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#07C160' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>微信</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { setShareSheetOpen(false); showToast('已分享'); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#fa9d3b' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Circle cx="12" cy="12" r="10" /><Path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>朋友圈</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { setShareSheetOpen(false); showToast('已发送'); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#4a90d9' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>短信</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { setShareSheetOpen(false); if (tokenUrl) { window.location.href = `mailto:?subject=procurement_${batchId}.pdf&body=${encodeURIComponent(publicUrl)}`; } }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#e06060' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><Path d="M22 6l-10 7L2 6" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>邮件</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={doDownload} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#6c6c80' }]}>
                  <DownloadSvg color="#fff" />
                </View>
                <Text style={styles.sheetItemLabel}>下载PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { copyLink(); setShareSheetOpen(false); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#5a5aaa' }]}>
                  <LinkSvg color="#fff" />
                </View>
                <Text style={styles.sheetItemLabel}>复制链接</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { doDownload(); setShareSheetOpen(false); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#2e8b57' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Rect x="3" y="3" width="18" height="18" rx="2" /><Circle cx="8.5" cy="8.5" r="1.5" /><Path d="M21 15l-5-5L5 21" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>保存图片</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { setShareSheetOpen(false); }} activeOpacity={0.7}>
                <View style={[styles.sheetIcon, { backgroundColor: '#3a3a48' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><Circle cx="12" cy="12" r="1" /><Circle cx="19" cy="12" r="1" /><Circle cx="5" cy="12" r="1" /></Svg>
                </View>
                <Text style={styles.sheetItemLabel}>更多</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShareSheetOpen(false)} style={styles.sheetCancel} activeOpacity={0.7}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════ Toast ══════ */}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ══════════════════════════════════════════════
   Styles
   ══════════════════════════════════════════════ */
const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg } as any,
    ...hdr,
    zoomPill: {
      position: 'absolute', top: 100, left: '50%',
      zIndex: 90,
      // @ts-ignore
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.55)',
      // @ts-ignore
      backdropFilter: 'blur(12px)',
      borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14,
    } as any,
    zoomPillText: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: c.textSub,
    },
    zoomBtns: {
      position: 'absolute', right: 16, bottom: 90,
      zIndex: 95, gap: 6,
    } as any,
    zoomBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(20,20,22,0.75)',
      // @ts-ignore
      backdropFilter: 'blur(12px)',
      borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
      justifyContent: 'center', alignItems: 'center',
      // @ts-ignore
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
    } as any,
    viewport: {
      flex: 1,
      marginTop: 100,
      marginBottom: 72,
      backgroundColor: '#141416',
      overflow: 'hidden',
    } as any,
    // Bottom toolbar
    toolbar: {
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
      height: 72,
      backgroundColor: 'rgba(20,20,22,0.88)',
      // @ts-ignore
      backdropFilter: 'blur(20px) saturate(1.5)',
      borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 8,
    } as any,
    toolBtn: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 90, paddingVertical: 8 } as any,
    toolLabel: { fontSize: 10, color: c.textSub, fontFamily: undefined },
    toolSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0 },
    // Share sheet
    sheetOverlay: {
      position: 'fixed', inset: 0, zIndex: 150,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    } as any,
    sheet: {
      backgroundColor: '#1E1E22',
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 32,
    } as any,
    sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
    sheetTitle: { fontSize: 13, fontWeight: '600', color: c.textSub, textAlign: 'center', marginBottom: 16, letterSpacing: 0.5 },
    sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginBottom: 16 } as any,
    sheetItem: { flexBasis: '25%', alignItems: 'center', paddingVertical: 12, gap: 8 } as any,
    sheetIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' } as any,
    sheetItemLabel: { fontSize: 11, color: c.textSub },
    sheetCancel: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#26262C', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' } as any,
    sheetCancelText: { fontSize: 14, fontWeight: '500', color: c.textSub },
    // Loading / error
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    hintText: { fontSize: FONTS.body.size, color: c.textSub, marginTop: 12 },
    errorText: { fontSize: FONTS.body.size, color: c.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.primary, borderRadius: 10 },
    retryText: { fontSize: FONTS.body.size, fontWeight: FONTS.body.weight as any, color: '#fff' },
    // Toast
    toastWrap: { position: 'absolute', bottom: 88, left: 0, right: 0, alignItems: 'center', zIndex: 200 } as any,
    toastBox: {
      backgroundColor: 'rgba(30,30,34,0.95)',
      // @ts-ignore
      backdropFilter: 'blur(16px)',
      borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18,
    } as any,
    toastText: { fontSize: 12, color: c.textMain },
  });
};
