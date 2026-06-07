import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';

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

/* ── Constants ── */
const TOOLBAR_H = 72;
const NAV_H = 56;
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

function buildDocPaperHTML(batch: BatchData): string {
  const batchNo = `2026-${String(batch.batch_number).padStart(4, '0')}`;
  const dateStr = formatDateCN(batch.date);
  const payLabel = batch.payment_method;
  const itemCount = batch.items.length;
  const totalQty = batch.items.reduce((s, it) => s + (it.quantity || 0), 0);

  let rowsHTML = '';
  batch.items.forEach(it => {
    rowsHTML += `<tr><td>${it.product_name}</td><td>${it.spec || ''}</td><td>${fmtMoney(it.unit_price)}</td><td>${it.quantity}</td><td>${fmtMoney(it.subtotal)}</td></tr>`;
  });

  return `<div class="doc-brand"><div class="doc-brand-name">柳 味 探 秘 科 技</div><div class="doc-brand-sub">LIUWEI TECHNOLOGY · 餐饮供应链管理</div></div>
<div class="doc-heading"><h1>进 货 单</h1><p>PURCHASE ORDER / RECEIPT</p></div>
<div class="doc-meta"><div class="doc-meta-item"><div class="doc-meta-label">NO.</div><div class="doc-meta-value">${batchNo}</div></div><div class="doc-meta-item"><div class="doc-meta-label">日期</div><div class="doc-meta-value">${dateStr}</div></div><div class="doc-meta-item"><div class="doc-meta-label">支付</div><div class="doc-meta-value">${payLabel}</div></div></div>
<table class="doc-table"><thead><tr><th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>${rowsHTML}</tbody></table>
<div class="doc-totals"><div class="doc-total-row"><span>商品种类</span><span>${itemCount} 种</span></div><div class="doc-total-row"><span>总件数</span><span>${totalQty} 件</span></div><div class="doc-total-row grand"><span>合计货款</span><span>${fmtMoney(batch.total)}</span></div></div>
${batch.note ? `<div class="doc-note">📝 ${batch.note}</div>` : ''}
<div class="doc-footer"><p>${batch.operator ? `经办人：${batch.operator} · ` : ''}柳味探秘科技 · 餐饮供应链管理系统<br>本单据由系统自动生成，具有法律效力</p></div>`;
}

/* ═══════════════ Styles (injected as CSS string) ═══════════════ */

const STYLE_CSS = `
:root{--bg:#141416;--surface:#1E1E22;--surface2:#26262C;--surface3:#2E2E36;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--text:#F0EDE8;--text2:rgba(240,237,232,.5);--text3:rgba(240,237,232,.28);--accent:#C0392B;--accent2:#8B2020;--accent-dim:rgba(192,57,43,.15);--sans:'Noto Sans SC',sans-serif;--mono:'DM Mono',monospace;--serif:'Lora',serif}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html.pdfv,body.pdfv{height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:var(--sans);touch-action:none}

.navbar{position:fixed;top:44px;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:20px 16px 8px;background:transparent;backdrop-filter:saturate(200%) blur(30px);-webkit-backdrop-filter:saturate(200%) blur(30px);border-bottom:0.5px solid rgba(0,0,0,0.06)}
.nav-left{display:flex;align-items:center}
.nav-title-wrap{position:absolute;left:50%;transform:translateX(-50%);text-align:center}
.nav-back{width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.30);backdrop-filter:saturate(200%) blur(30px);-webkit-backdrop-filter:saturate(200%) blur(30px);border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.nav-back:active{background:rgba(255,255,255,0.45)}
.nav-back svg{width:20px;height:20px;stroke:#2C2626;stroke-width:1.5;fill:none;display:block}
.nav-title{font-size:16px;font-weight:500;color:#2C2626;letter-spacing:.01em}
.nav-sub{font-size:10px;color:rgba(0,0,0,0.45);font-family:var(--mono);margin-top:1px}
.nav-right{display:flex;align-items:center;gap:6px}
.nav-action{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.30);backdrop-filter:saturate(200%) blur(30px);-webkit-backdrop-filter:saturate(200%) blur(30px);border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;position:relative}
.nav-action:active{background:rgba(255,255,255,0.45);transform:scale(.93)}
.nav-action svg{width:16px;height:16px;stroke:#555;stroke-width:1.8;fill:none}
.nav-action.accent-btn{background:rgba(192,57,43,0.12);border-color:rgba(192,57,43,0.25)}
.nav-action.accent-btn svg{stroke:#C0392B}

.page-pill{position:fixed;top:calc(44px + 71px);left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:20px;padding:4px 14px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;transition:opacity .3s;pointer-events:none}
.zoom-indicator{position:fixed;top:calc(44px + 71px);right:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line2);border-radius:8px;padding:4px 10px;font-size:11px;font-family:var(--mono);color:var(--text2);z-index:90;opacity:0;transition:opacity .25s;pointer-events:none}
.zoom-indicator.show{opacity:1}

.viewport{position:fixed;top:calc(44px + 60px);left:0;right:0;bottom:0;overflow:hidden;background:#fff}
.viewport-inner{width:100%;height:100%;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;position:relative;cursor:grab}
.viewport-inner.grabbing{cursor:grabbing}
.doc-sheet{position:absolute;transform-origin:center top;will-change:transform;padding:0 12px;top:12px;touch-action:none;user-select:none}
.doc-paper{background:#fff;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.3);overflow:hidden;width:340px;padding:28px 24px 36px}
.doc-brand{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e4de}
.doc-brand-name{font-size:13px;letter-spacing:.35em;color:#333;font-weight:500;margin-bottom:3px;font-family:'Noto Sans SC',-apple-system,sans-serif}
.doc-brand-sub{font-size:9px;letter-spacing:.18em;color:#aaa;font-family:'DM Mono',monospace}
.doc-heading{text-align:center;margin-bottom:18px}
.doc-heading h1{font-size:22px;font-weight:700;letter-spacing:.3em;color:#C0392B;margin-bottom:3px;font-family:'Noto Sans SC',-apple-system,sans-serif}
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

.toolbar{position:fixed;bottom:0;left:0;right:0;z-index:100;height:${TOOLBAR_H}px;background:rgba(20,20,22,.88);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding:0 8px 8px}
.tool-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .15s;border:none;background:none;flex:1;max-width:90px}
.tool-btn:active{background:var(--surface2);transform:scale(.95)}
.tool-btn svg{width:20px;height:20px;stroke:var(--text2);stroke-width:1.7;fill:none}
.tool-btn span{font-size:10px;color:var(--text3);font-family:var(--sans);white-space:nowrap}
.tool-btn.highlight svg{stroke:var(--accent)}
.tool-btn.highlight span{color:var(--accent)}
.tool-sep{width:1px;height:36px;background:var(--line);flex-shrink:0}

.zoom-strip{position:fixed;right:16px;bottom:${TOOLBAR_H + 18}px;z-index:95;display:flex;flex-direction:column;gap:6px}
.zoom-btn{width:40px;height:40px;border-radius:50%;background:rgba(20,20,22,.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 12px rgba(0,0,0,.35)}
.zoom-btn:active{background:var(--surface3);transform:scale(.92)}
.zoom-btn svg{width:16px;height:16px;stroke:var(--text2);stroke-width:2;fill:none}

.toast{position:fixed;bottom:${TOOLBAR_H + 16}px;left:50%;transform:translateX(-50%);background:rgba(30,30,34,.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.toast.show{opacity:1}

.sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;display:flex;align-items:flex-end}
.sheet-overlay.hidden{display:none}
.sheet{width:100%;background:var(--surface);border-radius:20px 20px 0 0;padding:0 0 32px;animation:slideUp .3s cubic-bezier(.32,.72,0,1)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
.sheet-handle{width:36px;height:4px;background:var(--line2);border-radius:2px;margin:12px auto 16px}
.sheet-title{font-size:13px;font-weight:600;color:var(--text2);text-align:center;margin-bottom:16px;letter-spacing:.04em}
.sheet-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:0 8px;margin-bottom:16px}
.sheet-action{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;padding:12px 4px;transition:all .15s;border:none;background:none}
.sheet-action:active{transform:scale(.95)}
.sheet-icon{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.sheet-icon svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:1.8}
.sheet-action span{font-size:11px;color:var(--text2)}
.sheet-cancel{margin:0 16px;padding:14px;border-radius:14px;background:var(--surface2);border:0.5px solid var(--line2);text-align:center;cursor:pointer;font-size:14px;font-weight:500;color:var(--text2)}
.sheet-cancel:active{background:var(--surface3)}
`;

const SHARE_ITEMS: [string, string, string][] = [
  ['微信', '#07c160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
  ['朋友圈', '#fa9d3b', 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32'],
  ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
  ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6'],
  ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'],
  ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
  ['保存图片', '#2e8b57', 'M3 3h18v18H3zM21 15l-5-5L5 21M8.5 8.5a1.5 1.5 0 100 .01'],
  ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
];

/* ═══════════════════════ PdfPreviewPage ═══════════════════════ */

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const portalReady = useRef(false);

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

  const title = t('procPdfTitle').replace('{n}', String(batchNumber));

  // Loading / Error states — rendered inside RN View
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <View style={styles.spinner} />
        </View>
      </View>
    );
  }

  if (error || !batch) {
    return (
      <View style={styles.container}>
        <View style={styles.errWrap}>
          <View style={styles.errTextWrap}>
            <span style={{ fontSize: 16, color: c.textSub }}>{error || '数据加载失败'}</span>
          </View>
          <div style={{ marginTop: 16 }}>
            <div
              onClick={onBack}
              style={{ padding: '10px 20px', backgroundColor: c.primary, borderRadius: 10, cursor: 'pointer', display: 'inline-block' }}
            >
              <span style={{ color: '#fff', fontSize: 14 }}>{t('goBack')}</span>
            </div>
          </div>
        </View>
      </View>
    );
  }

  // Main content — rendered via createPortal to document.body
  // This completely bypasses React Native's view hierarchy, ensuring:
  // - dangerouslySetInnerHTML works (real DOM)
  // - Event listeners attach to real DOM elements
  // - CSS positioning is relative to the viewport (not RN's animated containers)

  return createPortal(
    <PortalContent
      batch={batch}
      batchId={batchId}
      title={title}
      onBack={onBack}
      onReady={() => { portalReady.current = true; }}
    />,
    document.body
  );
}

/* ═══════════════════════ PortalContent (pure HTML/CSS/JS in a portal) ═══════════════════════ */

function PortalContent({
  batch, batchId, title, onBack, onReady,
}: {
  batch: BatchData;
  batchId: number;
  title: string;
  onBack: () => void;
  onReady: () => void;
}) {
  // Refs for DOM elements
  const sheetRef = useRef<HTMLDivElement>(null);
  const vpInnerRef = useRef<HTMLDivElement>(null);
  const zoomIndRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const sheetOverlayRef = useRef<HTMLDivElement>(null);

  // Zoom/pan state (mutable refs for smooth updates)
  const zoomRef = useRef({
    scale: 1, tx: 0, ty: 0,
    maxTxCache: 0, maxTyCache: 0,
    drag: { active: false as boolean, startX: 0, startY: 0, startTx: 0, startTy: 0 },
    touch: { mode: 'none' as string, startX: 0, startY: 0, startTx: 0, startTy: 0, pinchDist: 0, pinchScale: 0, lastTap: 0 },
    zoomTimer: null as ReturnType<typeof setTimeout> | null,
    rafId: null as number | null,
  });

  // ── Transform helpers ──
  const applyTransform = useCallback((animated: boolean) => {
    const sheet = sheetRef.current;
    const zi = zoomRef.current;
    if (!sheet) return;
    sheet.style.transition = animated ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'none';
    sheet.style.transform = `translate(calc(-50% + ${zi.tx}px), ${zi.ty}px) scale(${zi.scale})`;
    sheet.style.left = '50%';
    const zid = zoomIndRef.current;
    if (zid) zid.textContent = Math.round(zi.scale * 100) + '%';
  }, []);

  // Schedule a batched render via RAF (no more than one style write per frame)
  const scheduleRender = useCallback(() => {
    const zi = zoomRef.current;
    if (zi.rafId !== null) return;
    zi.rafId = requestAnimationFrame(() => {
      zi.rafId = null;
      applyTransform(false);
    });
  }, [applyTransform]);

  // Recalculate translation bounds (only needed when scale or viewport size changes)
  const recalcBounds = useCallback(() => {
    const vp = vpInnerRef.current;
    const sheet = sheetRef.current;
    const zi = zoomRef.current;
    if (!vp || !sheet) return;
    const paper = sheet.querySelector('.doc-paper') as HTMLElement;
    if (!paper) return;
    const dw = (paper.offsetWidth + 24) * zi.scale;
    const dh = (paper.offsetHeight + 24) * zi.scale;
    zi.maxTxCache = Math.max(0, (dw - vp.clientWidth) / 2);
    zi.maxTyCache = Math.max(0, (dh - vp.clientHeight) / 2 + 20);
  }, []);

  // Fast clamp using cached bounds — no querySelector, no offsetWidth read
  const clampTranslation = useCallback(() => {
    const zi = zoomRef.current;
    zi.tx = Math.max(-zi.maxTxCache, Math.min(zi.maxTxCache, zi.tx));
    zi.ty = Math.max(-20, Math.min(zi.maxTyCache, zi.ty));
  }, []);

  const flashZoom = useCallback(() => {
    const zid = zoomIndRef.current;
    const zi = zoomRef.current;
    if (!zid) return;
    zid.classList.add('show');
    if (zi.zoomTimer) clearTimeout(zi.zoomTimer);
    zi.zoomTimer = setTimeout(() => zid.classList.remove('show'), 1500);
  }, []);

  // ── Init zoom (fit to width) ──
  const initZoom = useCallback(() => {
    const vp = vpInnerRef.current;
    const sheet = sheetRef.current;
    const zi = zoomRef.current;
    if (!vp || !sheet) return false;
    const paper = sheet.querySelector('.doc-paper') as HTMLElement;
    if (!paper) return false;
    const vw = vp.clientWidth;
    if (!vw || vw < 100) return false;
    const docW = paper.offsetWidth + 24;
    zi.scale = Math.min(1, (vw - 24) / docW);
    zi.tx = 0;
    zi.ty = 0;
    recalcBounds();
    applyTransform(false);
    return true;
  }, [applyTransform, recalcBounds]);

  // Retry initZoom until viewport is sized
  useEffect(() => {
    let attempts = 0;
    const tryFit = () => {
      if (initZoom()) {
        onReady();
        return;
      }
      if (attempts++ < 20) setTimeout(tryFit, 100);
    };
    setTimeout(tryFit, 50);
  }, [initZoom, onReady]);

  // ── Gesture setup ──
  useEffect(() => {
    const vp = vpInnerRef.current;
    if (!vp) return;
    const zi = zoomRef.current;

    // Mouse drag
    const onMouseDown = (e: MouseEvent) => {
      zi.drag = { active: true, startX: e.clientX, startY: e.clientY, startTx: zi.tx, startTy: zi.ty };
      vp.classList.add('grabbing');
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!zi.drag.active) return;
      zi.tx = zi.drag.startTx + (e.clientX - zi.drag.startX);
      zi.ty = zi.drag.startTy + (e.clientY - zi.drag.startY);
      clampTranslation();
      scheduleRender();
    };
    const onMouseUp = () => { zi.drag.active = false; vp.classList.remove('grabbing'); };

    // Wheel
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      zi.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zi.scale + delta));
      recalcBounds();
      clampTranslation();
      scheduleRender();
      flashZoom();
    };

    // Touch
    const getDist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const tc = zi.touch;
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - tc.lastTap < 300) {
          if (zi.scale > 1.1) { zi.scale = 1; zi.tx = 0; zi.ty = 0; }
          else { zi.scale = 2; }
          recalcBounds(); clampTranslation(); applyTransform(true); flashZoom();
          tc.lastTap = 0; return;
        }
        tc.lastTap = now;
        tc.mode = 'drag';
        tc.startX = e.touches[0].clientX; tc.startY = e.touches[0].clientY;
        tc.startTx = zi.tx; tc.startTy = zi.ty;
        vp.classList.add('grabbing');
      } else if (e.touches.length === 2) {
        tc.mode = 'pinch';
        tc.pinchDist = getDist(e.touches);
        tc.pinchScale = zi.scale;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const tc = zi.touch;
      if (tc.mode === 'drag' && e.touches.length === 1) {
        zi.tx = tc.startTx + (e.touches[0].clientX - tc.startX);
        zi.ty = tc.startTy + (e.touches[0].clientY - tc.startY);
        clampTranslation(); scheduleRender();
      } else if (tc.mode === 'pinch' && e.touches.length === 2) {
        const dist = getDist(e.touches);
        zi.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, tc.pinchScale * (dist / tc.pinchDist)));
        recalcBounds(); clampTranslation(); scheduleRender(); flashZoom();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const tc = zi.touch;
      if (e.touches.length === 0) { tc.mode = 'none'; vp.classList.remove('grabbing'); }
      else if (e.touches.length === 1 && tc.mode === 'pinch') {
        tc.mode = 'drag';
        tc.startX = e.touches[0].clientX; tc.startY = e.touches[0].clientY;
        tc.startTx = zi.tx; tc.startTy = zi.ty;
      }
    };

    vp.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('touchstart', onTouchStart, { passive: false });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd);

    // Resize handler
    const onResize = () => { recalcBounds(); clampTranslation(); applyTransform(false); };
    window.addEventListener('resize', onResize);

    return () => {
      vp.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
    };
  }, [clampTranslation, applyTransform, flashZoom, recalcBounds, scheduleRender]);

  // ── Actions ──
  const doDownload = useCallback(() => {
    showToast('⬇️', 'PDF 下载中…');
    const a = document.createElement('a');
    a.href = `/api/procurement-batches/${batchId}/pdf`;
    a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    closeSheet();
  }, [batchId]);

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast('🔗', '链接已复制到剪贴板');
  }, []);

  const showToast = useCallback((icon: string, text: string) => {
    const t = toastRef.current;
    if (!t) return;
    t.querySelector('.toast-icon')!.textContent = icon;
    t.querySelector('.toast-text')!.textContent = text;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }, []);

  const openSheet = useCallback(() => {
    sheetOverlayRef.current?.classList.remove('hidden');
  }, []);

  const closeSheet = useCallback(() => {
    sheetOverlayRef.current?.classList.add('hidden');
  }, []);

  // ── Zoom button handlers ──
  const stepZoom = useCallback((delta: number) => {
    const zi = zoomRef.current;
    zi.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zi.scale + delta));
    recalcBounds();
    clampTranslation();
    applyTransform(true);
    flashZoom();
  }, [clampTranslation, applyTransform, flashZoom, recalcBounds]);

  const resetZoom = useCallback(() => {
    const zi = zoomRef.current;
    zi.scale = 1; zi.tx = 0; zi.ty = 0;
    recalcBounds();
    applyTransform(true);
    flashZoom();
  }, [applyTransform, flashZoom, recalcBounds]);

  const docPaperHTML = buildDocPaperHTML(batch);

  // Render the entire viewer as raw HTML in the portal
  return (
    <div className="pdfv" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Navbar */}
      <div className="navbar">
        <div className="nav-left">
          <div className="nav-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        <div className="nav-title-wrap">
          <div className="nav-title">{title}</div>
        </div>
        <div className="nav-right">
          <div className="nav-action" onClick={doDownload}>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
        </div>
      </div>

      {/* Page pill */}
      <div className="page-pill">第 1 页 / 共 1 页</div>

      {/* Zoom indicator */}
      <div className="zoom-indicator" ref={zoomIndRef}>100%</div>

      {/* Viewport */}
      <div className="viewport">
        <div className="viewport-inner" ref={vpInnerRef}>
          <div className="doc-sheet" ref={sheetRef}>
            <div className="doc-paper" dangerouslySetInnerHTML={{ __html: docPaperHTML }} />
          </div>
        </div>
      </div>

      {/* Zoom buttons */}
      <div className="zoom-strip">
        <div className="zoom-btn" onClick={() => stepZoom(0.25)}>
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div className="zoom-btn" onClick={resetZoom}>
          <svg viewBox="0 0 24 24"><path d="M3.5 3.5l4 4M20.5 3.5l-4 4M20.5 20.5l-4-4M3.5 20.5l4-4"/></svg>
        </div>
        <div className="zoom-btn" onClick={() => stepZoom(-0.25)}>
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="toolbar">
        <button className="tool-btn" onClick={doDownload}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>下载</span>
        </button>
        <div className="tool-sep" />
        <button className="tool-btn" onClick={openSheet}>
          <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>分享</span>
        </button>
        <div className="tool-sep" />
        <button className="tool-btn" onClick={copyLink}>
          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          <span>复制链接</span>
        </button>
        <div className="tool-sep" />
        <button className="tool-btn highlight" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <span>打印</span>
        </button>
      </div>

      {/* Toast */}
      <div className="toast" ref={toastRef}>
        <span className="toast-icon" />
        <span className="toast-text" />
      </div>

      {/* Share sheet overlay */}
      <div className="sheet-overlay hidden" ref={sheetOverlayRef} onClick={(e) => { if (e.target === sheetOverlayRef.current) closeSheet(); }}>
        <div className="sheet">
          <div className="sheet-handle" />
          <div className="sheet-title">分享进货单</div>
          <div className="sheet-actions">
            {SHARE_ITEMS.map(function(item) {
              const label = item[0];
              const bg = item[1];
              const d = item[2];
              return (
                <button key={label} className="sheet-action" onClick={function() { closeSheet(); showToast('📤', '已发送至 ' + label); }}>
                  <div className="sheet-icon" style={{ backgroundColor: bg }}>
                    <svg viewBox="0 0 24 24"><path d={d} /></svg>
                  </div>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className="sheet-cancel" onClick={closeSheet}>取消</div>
        </div>
      </div>

      {/* Injected stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_CSS }} />
    </div>
  );
}

/* ═══════════════════════ RN styles (for loading/error states) ═══════════════════════ */

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141416',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingWrap: {
    alignItems: 'center' as const,
    gap: 12,
  },
  spinner: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, borderColor: 'rgba(240,237,232,.15)',
    borderTopColor: c.primary,
  } as any,
  errWrap: {
    alignItems: 'center' as const,
    padding: 24,
  },
  errTextWrap: {
    marginBottom: 8,
  },
});
