import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';
import { historyHeader } from '../sharedStyles';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

interface BatchData {
  batch_number: number;
  date: string;
  payment_method: string;
  category: string;
  total: number;
  note?: string;
  operator?: string;
  items: Array<{
    product_name: string;
    spec: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
  }>;
}

/* ── Icons ── */
const DownloadSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
));

const ShareSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <Path d="M16 6l-4-4-4 4" />
    <Line x1="12" y1="2" x2="12" y2="15" />
  </Svg>
));

const LinkSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </Svg>
));

const PrinterSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9V2h12v7" />
    <Path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <Rect x="6" y="14" width="12" height="8" />
  </Svg>
));

const ZoomInSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
));

const ZoomResetSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M3.5 3.5l4 4M20.5 3.5l-4 4M20.5 20.5l-4-4M3.5 20.5l4-4" />
  </Svg>
));

const ZoomOutSvg = React.memo(({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
));

/* ── Helpers ── */
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;

function formatDateCN(raw: string): string {
  try {
    const d = new Date(raw + 'T00:00:00');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch { return raw; }
}

function fmtMoney(v: number): string {
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildDocumentHTML(batch: BatchData): string {
  const batchNo = `2026-${String(batch.batch_number).padStart(4, '0')}`;
  const dateStr = formatDateCN(batch.date);
  const payLabel = (t as any)('pay' + batch.payment_method.charAt(0).toUpperCase() + batch.payment_method.slice(1)) || batch.payment_method;
  const itemCount = batch.items.length;
  const totalQty = batch.items.reduce((s, it) => s + (it.quantity || 0), 0);

  let rowsHTML = '';
  batch.items.forEach(it => {
    rowsHTML += `<tr><td>${it.product_name}</td><td>${it.spec || ''}</td><td>${fmtMoney(it.unit_price)}</td><td>${it.quantity}</td><td>${fmtMoney(it.subtotal)}</td></tr>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans SC',-apple-system,sans-serif;background:transparent;display:flex;justify-content:center;padding:12px 0}
.doc-paper{background:#fff;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.3);overflow:hidden;width:340px;padding:28px 24px 36px}
.doc-brand{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e4de}
.doc-brand-name{font-size:13px;letter-spacing:.35em;color:#333;font-weight:500;margin-bottom:3px}
.doc-brand-sub{font-size:9px;letter-spacing:.18em;color:#aaa;font-family:'DM Mono',monospace}
.doc-heading{text-align:center;margin-bottom:18px}
.doc-heading h1{font-size:22px;font-weight:700;letter-spacing:.3em;color:#C0392B;margin-bottom:3px}
.doc-heading p{font-size:8px;letter-spacing:.15em;color:#aaa;font-family:'DM Mono',monospace}
.doc-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;font-size:10px;margin-bottom:16px;padding:10px 0;border-top:1px solid #e8e4de;border-bottom:1px solid #e8e4de}
.doc-meta-label{color:#aaa;margin-bottom:2px;font-family:'DM Mono',monospace;font-size:8px;letter-spacing:.05em}
.doc-meta-value{color:#222;font-weight:500;font-size:10px}
.doc-table{width:100%;border-collapse:collapse;font-size:9.5px}
.doc-table th{background:#7a1a1a;color:#fff;padding:7px 6px;text-align:left;font-weight:500}
.doc-table th:last-child{text-align:right}
.doc-table th:nth-child(3),.doc-table th:nth-child(4){text-align:center}
.doc-table td{padding:7px 6px;border-bottom:1px solid #f0ece6;color:#222;vertical-align:middle}
.doc-table td:last-child{text-align:right;font-weight:600;color:#7a1a1a;font-family:'DM Mono',monospace}
.doc-table td:nth-child(3){text-align:center;font-family:'DM Mono',monospace;color:#555}
.doc-table td:nth-child(4){text-align:center;font-family:'DM Mono',monospace;color:#333}
.doc-table tr:nth-child(even) td{background:#faf9f7}
.doc-table tr:last-child td{border-bottom:none}
.doc-totals{margin-top:16px;padding-top:12px;border-top:2px solid #e8e4de}
.doc-total-row{display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-bottom:5px}
.doc-total-row span:first-child{color:#888}
.doc-total-row span:last-child{font-family:'DM Mono',monospace;color:#333}
.doc-total-row.grand{margin-top:8px;padding-top:8px;border-top:1px solid #e8e4de}
.doc-total-row.grand span:first-child{font-size:12px;font-weight:600;color:#222}
.doc-total-row.grand span:last-child{font-size:16px;font-weight:700;color:#7a1a1a;font-family:'DM Mono',monospace}
.doc-footer{margin-top:24px;text-align:center;padding-top:14px;border-top:1px solid #ede9e3}
.doc-footer p{font-size:8px;color:#bbb;letter-spacing:.08em;font-family:'DM Mono',monospace;line-height:1.8}
.doc-note{margin-top:12px;padding:8px 10px;background:#faf9f7;border-radius:4px;font-size:9px;color:#888;font-family:'DM Mono',monospace}
</style></head><body><div class="doc-paper">
<div class="doc-brand"><div class="doc-brand-name">柳 味 探 秘 科 技</div><div class="doc-brand-sub">LIUWEI TECHNOLOGY · 餐饮供应链管理</div></div>
<div class="doc-heading"><h1>进 货 单</h1><p>PURCHASE ORDER / RECEIPT</p></div>
<div class="doc-meta"><div class="doc-meta-item"><div class="doc-meta-label">NO.</div><div class="doc-meta-value">${batchNo}</div></div><div class="doc-meta-item"><div class="doc-meta-label">日期</div><div class="doc-meta-value">${dateStr}</div></div><div class="doc-meta-item"><div class="doc-meta-label">支付</div><div class="doc-meta-value">${payLabel}</div></div></div>
<table class="doc-table"><thead><tr><th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>${rowsHTML}</tbody></table>
<div class="doc-totals"><div class="doc-total-row"><span>商品种类</span><span>${itemCount} 种</span></div><div class="doc-total-row"><span>总件数</span><span>${totalQty} 件</span></div><div class="doc-total-row grand"><span>合计货款</span><span>${fmtMoney(batch.total)}</span></div></div>
${batch.note ? `<div class="doc-note">📝 ${batch.note}</div>` : ''}
<div class="doc-footer"><p>${batch.operator ? `经办人：${batch.operator} · ` : ''}柳味探秘科技 · 餐饮供应链管理系统<br>本单据由系统自动生成，具有法律效力</p></div>
</div></body></html>`;
}

/* ═══════════════════════ PdfPreviewPage ═══════════════════════ */

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [toastIcon, setToastIcon] = useState('');

  // Zoom / pan state
  const [pagePill, setPagePill] = useState('第 1 页 / 共 1 页');
  const [zoomPercent, setZoomPercent] = useState('100%');
  const [zoomVisible, setZoomVisible] = useState(false);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const touchRef = useRef({ mode: 'none' as string, startX: 0, startY: 0, startTx: 0, startTy: 0, pinchDist: 0, pinchScale: 0, lastTap: 0 });
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch batch data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data: any = await api.getProcurementBatchDetail(batchId);
        if (!cancelled) {
          if (data && data.items) {
            setBatch(data);
          } else {
            setError('未找到进货单数据');
          }
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || '加载进货单失败');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  // Apply zoom/pan transform to the sheet element
  const applyTransform = useCallback((animated: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animated ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    sheet.style.transform = `translate(calc(-50% + ${txRef.current}px), ${tyRef.current}px) scale(${scaleRef.current})`;
    // @ts-ignore
    sheet.style.left = '50%';
    setZoomPercent(Math.round(scaleRef.current * 100) + '%');
  }, []);

  // Flash zoom indicator
  const flashZoom = useCallback(() => {
    setZoomVisible(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setZoomVisible(false), 1500);
  }, []);

  // Clamp translation
  const clampTranslation = useCallback(() => {
    const vp = viewportRef.current;
    const sheet = sheetRef.current;
    if (!vp || !sheet) return;
    const paper = sheet.querySelector('.doc-paper') as HTMLElement;
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

  // Fit on load
  useEffect(() => {
    if (!batch || !viewportRef.current) return;
    const timer = setTimeout(() => {
      const vp = viewportRef.current;
      const sheet = sheetRef.current;
      if (!vp || !sheet) return;
      const paper = sheet.querySelector('.doc-paper') as HTMLElement;
      if (!paper) return;
      const vw = vp.clientWidth;
      const docW = paper.offsetWidth + 24;
      scaleRef.current = Math.min(1, (vw - 24) / docW);
      txRef.current = 0;
      tyRef.current = 0;
      applyTransform(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [batch, applyTransform]);

  // Handle window resize
  useEffect(() => {
    const onResize = () => { clampTranslation(); applyTransform(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampTranslation, applyTransform]);

  // ── Zoom controls ──
  const stepZoom = useCallback((delta: number) => {
    scaleRef.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleRef.current + delta));
    clampTranslation();
    applyTransform(true);
    flashZoom();
  }, [clampTranslation, applyTransform, flashZoom]);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    applyTransform(true);
    flashZoom();
  }, [applyTransform, flashZoom]);

  // ── Mouse drag & wheel on viewport (via effect) ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = {
        active: true,
        startX: e.clientX, startY: e.clientY,
        startTx: txRef.current, startTy: tyRef.current,
      };
      vp.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      txRef.current = dragRef.current.startTx + (e.clientX - dragRef.current.startX);
      tyRef.current = dragRef.current.startTy + (e.clientY - dragRef.current.startY);
      clampTranslation();
      applyTransform(false);
    };
    const onMouseUp = () => {
      dragRef.current.active = false;
      vp.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scaleRef.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleRef.current + delta));
      clampTranslation();
      applyTransform(false);
      flashZoom();
    };

    vp.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      vp.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      vp.removeEventListener('wheel', onWheel);
    };
  }, [clampTranslation, applyTransform, flashZoom]);

  // ── Touch events ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const tc = touchRef.current;
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - tc.lastTap < 300) {
          // Double tap → toggle zoom
          if (scaleRef.current > 1.1) { scaleRef.current = 1; txRef.current = 0; tyRef.current = 0; }
          else { scaleRef.current = 2; }
          clampTranslation();
          applyTransform(true);
          flashZoom();
          tc.lastTap = 0;
          return;
        }
        tc.lastTap = now;
        tc.mode = 'drag';
        tc.startX = e.touches[0].clientX;
        tc.startY = e.touches[0].clientY;
        tc.startTx = txRef.current;
        tc.startTy = tyRef.current;
        vp.style.cursor = 'grabbing';
      } else if (e.touches.length === 2) {
        tc.mode = 'pinch';
        tc.pinchDist = getDist(e.touches);
        tc.pinchScale = scaleRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const tc = touchRef.current;
      if (tc.mode === 'drag' && e.touches.length === 1) {
        txRef.current = tc.startTx + (e.touches[0].clientX - tc.startX);
        tyRef.current = tc.startTy + (e.touches[0].clientY - tc.startY);
        clampTranslation();
        applyTransform(false);
      } else if (tc.mode === 'pinch' && e.touches.length === 2) {
        const dist = getDist(e.touches);
        scaleRef.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE, tc.pinchScale * (dist / tc.pinchDist)));
        clampTranslation();
        applyTransform(false);
        flashZoom();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const tc = touchRef.current;
      if (e.touches.length === 0) { tc.mode = 'none'; vp.style.cursor = 'grab'; }
      else if (e.touches.length === 1 && tc.mode === 'pinch') {
        tc.mode = 'drag';
        tc.startX = e.touches[0].clientX;
        tc.startY = e.touches[0].clientY;
        tc.startTx = txRef.current;
        tc.startTy = tyRef.current;
      }
    };

    vp.addEventListener('touchstart', onTouchStart, { passive: false });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd);
    return () => {
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
    };
  }, [clampTranslation, applyTransform, flashZoom]);

  // ── Toast ──
  const showToast = useCallback((icon: string, msg: string) => {
    setToastIcon(icon);
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  // ── Actions ──
  const doDownload = useCallback(() => {
    showToast('⬇️', 'PDF 下载中…');
    // Trigger server PDF download
    if (typeof window !== 'undefined') {
      const a = document.createElement('a');
      a.href = `/api/procurement-batches/${batchId}/pdf`;
      a.download = `procurement_${batchId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setShareSheetOpen(false);
  }, [batchId, showToast]);

  const publicUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = useCallback(() => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicUrl).catch(() => {});
    }
    showToast('🔗', '链接已复制到剪贴板');
  }, [publicUrl, showToast]);

  const shareAction = useCallback((platform: string) => {
    setShareSheetOpen(false);
    if (platform === '下载PDF') { doDownload(); return; }
    if (platform === '复制链接') { copyLink(); return; }
    if (platform === '邮件') {
      window.location.href = `mailto:?subject=procurement_${batchId}.pdf&body=${encodeURIComponent(publicUrl)}`;
      return;
    }
    showToast('📤', `已发送至 ${platform}`);
  }, [doDownload, copyLink, publicUrl, batchId, showToast]);

  // ── Header ──
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
        <View style={styles.backBtn}><BackArrow color={c.textMain} /></View>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {t('procPdfTitle').replace('{n}', String(batchNumber))}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.viewerArea}>
          <View style={styles.centered}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={styles.hintText}>加载进货单数据…</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Error ──
  if (error || !batch) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.viewerArea}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error || '数据加载失败'}</Text>
            <TouchableOpacity onPress={onBack} style={styles.retryBtn} activeOpacity={0.7}>
              <Text style={styles.retryText}>{t('goBack')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Main ──
  const docHTML = buildDocumentHTML(batch);

  return (
    <View style={styles.container}>
      {renderHeader()}

      {/* Page pill */}
      <View style={styles.pagePill} pointerEvents="none">
        <Text style={styles.pagePillText}>{pagePill}</Text>
      </View>

      {/* Zoom indicator */}
      <View style={[styles.zoomInd, zoomVisible && styles.zoomIndShow as any]} pointerEvents="none">
        <Text style={styles.zoomIndText}>{zoomPercent}</Text>
      </View>

      {/* Viewport */}
      <div ref={viewportRef as any} style={styles.viewport as any}>
        <div style={styles.viewportInner as any}>
          <div
            ref={sheetRef as any}
            style={styles.docSheet as any}
          >
            <div
              style={styles.docPaper as any}
              dangerouslySetInnerHTML={{ __html: docHTML }}
            />
          </div>
        </div>
      </div>

      {/* Zoom buttons strip */}
      <View style={styles.zoomStrip}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => stepZoom(0.25)} activeOpacity={0.7}>
          <ZoomInSvg color="rgba(240,237,232,0.5)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={resetZoom} activeOpacity={0.7}>
          <ZoomResetSvg color="rgba(240,237,232,0.5)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => stepZoom(-0.25)} activeOpacity={0.7}>
          <ZoomOutSvg color="rgba(240,237,232,0.5)" />
        </TouchableOpacity>
      </View>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={doDownload} activeOpacity={0.7}>
          <DownloadSvg color="rgba(240,237,232,0.5)" />
          <Text style={styles.toolLabel}>下载</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShareSheetOpen(true)} activeOpacity={0.7}>
          <ShareSvg color="rgba(240,237,232,0.5)" />
          <Text style={styles.toolLabel}>分享</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={copyLink} activeOpacity={0.7}>
          <LinkSvg color="rgba(240,237,232,0.5)" />
          <Text style={styles.toolLabel}>复制链接</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => window.print()} activeOpacity={0.7}>
          <PrinterSvg color="#C0392B" />
          <Text style={[styles.toolLabel, { color: '#C0392B' }]}>打印</Text>
        </TouchableOpacity>
      </View>

      {/* Share sheet */}
      {shareSheetOpen && (
        <View style={styles.sheetOverlay as any}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareSheetOpen(false)} />
          <View style={styles.sheet as any}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>分享进货单</Text>
            <View style={styles.sheetGrid}>
              {([
                ['微信', '#07C160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                ['朋友圈', '#fa9d3b', 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32'],
                ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
                ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6'],
                ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'],
                ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
                ['保存图片', '#2e8b57', 'M3 3h18v18H3zM21 15l-5-5L5 21M8.5 8.5a1.5 1.5 0 100 .01'],
                ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
              ] as [string, string, string][]).map(([label, bg, d]) => (
                <TouchableOpacity key={label} style={styles.sheetItem} onPress={() => shareAction(label)} activeOpacity={0.7}>
                  <View style={[styles.sheetIcon, { backgroundColor: bg }]}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}>
                      <Path d={d} />
                    </Svg>
                  </View>
                  <Text style={styles.sheetItemLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShareSheetOpen(false)} style={styles.sheetCancel} activeOpacity={0.7}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Toast */}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toastBox}>
            <Text style={styles.toastIcon}>{toastIcon}</Text>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1, minHeight: '100vh' } as any,
    ...hdr,
    viewerArea: {
      flex: 1,
      backgroundColor: '#141416',
      marginTop: 100,
    } as any,
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 24 },
    hintText: { fontSize: FONTS.body.size, color: 'rgba(240,237,232,0.5)', marginTop: 12 },
    errorText: { fontSize: FONTS.body.size, color: c.danger, textAlign: 'center' as const, marginBottom: 16 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.primary, borderRadius: 10 },
    retryText: { fontSize: FONTS.body.size, fontWeight: FONTS.body.weight as any, color: '#fff' },

    // Page pill
    pagePill: {
      position: 'fixed' as any, top: 68, left: '50%', transform: 'translateX(-50%)' as any, zIndex: 90,
      backgroundColor: 'rgba(0,0,0,.55)', backdropFilter: 'blur(12px)' as any,
      borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', borderRadius: 20,
      paddingVertical: 4, paddingHorizontal: 14,
    } as any,
    pagePillText: { fontSize: 11, color: 'rgba(240,237,232,0.5)', fontFamily: '"DM Mono", monospace' },

    // Zoom indicator
    zoomInd: {
      position: 'fixed' as any, top: 68, right: 16, zIndex: 90,
      backgroundColor: 'rgba(0,0,0,.55)', backdropFilter: 'blur(12px)' as any,
      borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', borderRadius: 8,
      paddingVertical: 4, paddingHorizontal: 10,
      opacity: 0, transition: 'opacity .25s' as any, pointerEvents: 'none' as any,
    } as any,
    zoomIndShow: { opacity: 1 } as any,
    zoomIndText: { fontSize: 11, color: 'rgba(240,237,232,0.5)', fontFamily: '"DM Mono", monospace' },

    // Viewport (dark background, full screen with navbar/toolbar padding)
    viewport: {
      position: 'fixed' as any, inset: 0, zIndex: 1,
      paddingTop: 56, paddingBottom: 72,
      overflow: 'hidden' as any,
      backgroundColor: '#141416',
    } as any,
    viewportInner: {
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflow: 'hidden', position: 'relative', cursor: 'grab',
    } as any,

    // Document sheet — positioned absolute, centered via left:50% + translate
    docSheet: {
      position: 'absolute' as any,
      transformOrigin: 'center top' as any,
      willChange: 'transform' as any,
      paddingHorizontal: 12,
      top: 12,
      touchAction: 'none' as any,
      userSelect: 'none' as any,
    } as any,
    docPaper: {
      background: '#fff', borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.3)',
      overflow: 'hidden', width: 340,
      padding: '28px 24px 36px',
    } as any,

    // Zoom buttons strip
    zoomStrip: {
      position: 'fixed' as any, right: 16, bottom: 90, zIndex: 95,
      display: 'flex', flexDirection: 'column', gap: 6,
    } as any,
    zoomBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(20,20,22,.75)', backdropFilter: 'blur(12px)' as any,
      borderWidth: 1, borderColor: 'rgba(255,255,255,.12)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
      boxShadow: '0 2px 12px rgba(0,0,0,.35)',
    } as any,

    // Toolbar
    toolbar: {
      position: 'fixed' as any, bottom: 0, left: 0, right: 0, zIndex: 100,
      height: 72,
      backgroundColor: 'rgba(20,20,22,.88)',
      backdropFilter: 'blur(20px) saturate(1.5)' as any,
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.07)',
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const,
      paddingBottom: 8,
    } as any,
    toolLabel: { fontSize: 10, color: 'rgba(240,237,232,0.28)' },
    toolBtn: { flex: 1, alignItems: 'center' as const, gap: 4, maxWidth: 90, paddingVertical: 8 } as any,
    toolSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,.07)', flexShrink: 0 },

    // Share sheet
    sheetOverlay: { position: 'fixed' as any, inset: 0, zIndex: 150, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' as const } as any,
    sheet: { backgroundColor: '#1E1E22', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 } as any,
    sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 2, alignSelf: 'center' as const, marginTop: 12, marginBottom: 16 },
    sheetTitle: { fontSize: 13, fontWeight: '600' as const, color: 'rgba(240,237,232,0.5)', textAlign: 'center' as const, marginBottom: 16, letterSpacing: 0.5 },
    sheetGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: 8, marginBottom: 16 } as any,
    sheetItem: { flexBasis: '25%' as any, alignItems: 'center' as const, paddingVertical: 12, gap: 8 } as any,
    sheetIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const } as any,
    sheetItemLabel: { fontSize: 11, color: 'rgba(240,237,232,0.5)' },
    sheetCancel: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#26262C', borderWidth: 0.5, borderColor: 'rgba(255,255,255,.12)', alignItems: 'center' as const } as any,
    sheetCancelText: { fontSize: 14, fontWeight: '500' as const, color: 'rgba(240,237,232,0.5)' },

    // Toast
    toastWrap: { position: 'fixed' as any, bottom: 88, left: '50%', transform: 'translateX(-50%)' as any, alignItems: 'center' as const, zIndex: 200 } as any,
    toastBox: { backgroundColor: 'rgba(30,30,34,.95)', backdropFilter: 'blur(16px)' as any, borderWidth: 0.5, borderColor: 'rgba(255,255,255,.12)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, flexDirection: 'row' as const, gap: 8, whiteSpace: 'nowrap' as any } as any,
    toastIcon: { fontSize: 14 },
    toastText: { fontSize: 12, color: '#F0EDE8' },
  });
};
