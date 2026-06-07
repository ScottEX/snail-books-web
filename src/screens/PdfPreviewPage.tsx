import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

function fmtMoney(v: number): string {
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw + 'T00:00:00');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch { return raw; }
}

/* ═══════════════════════ PdfPreviewPage ═══════════════════════ */

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data: any = await api.getProcurementBatchDetail(batchId);
        if (!cancelled) {
          if (data?.items) setBatch(data);
          else setError('未找到数据');
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || '加载失败'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  const title = t('procPdfTitle').replace('{n}', String(batchNumber));

  if (loading || error || !batch) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#141416', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center', color: '#F0EDE8' }}>
          {loading ? <div style={{ fontSize: 16 }}>加载中…</div> : (
            <>
              <div style={{ fontSize: 16, marginBottom: 16 }}>{error || '数据加载失败'}</div>
              <button onClick={onBack} style={{ padding: '10px 20px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>返回</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const batchNo = `2026-${String(batch.batch_number).padStart(4, '0')}`;
  const dateStr = formatDate(batch.date);
  const itemCount = batch.items.length;
  const totalQty = batch.items.reduce((s, it) => s + (it.quantity || 0), 0);

  let rows = '';
  batch.items.forEach(it => {
    rows += `<tr><td class="col-name">${it.product_name}</td><td class="col-spec">${it.spec || ''}</td><td class="col-price">${fmtMoney(it.unit_price)}</td><td class="col-qty">${it.quantity}</td><td class="col-sub">${fmtMoney(it.subtotal)}</td></tr>`;
  });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#141416', color: '#F0EDE8', fontFamily: '-apple-system, "Noto Sans SC", sans-serif' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, background: 'rgba(20,20,22,.85)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: '#26262C', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0EDE8" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 8px 80px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 4, padding: '28px 24px 36px', color: '#222', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .doc-brand{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e4de}
            .doc-brand-name{font-size:13px;letter-spacing:.35em;color:#333;font-weight:500;margin-bottom:3px}
            .doc-brand-sub{font-size:9px;letter-spacing:.18em;color:#aaa;font-family:'DM Mono',monospace}
            .doc-heading{text-align:center;margin-bottom:18px}
            .doc-heading h1{font-size:22px;font-weight:700;letter-spacing:.3em;color:#C0392B;margin-bottom:3px}
            .doc-heading p{font-size:8px;letter-spacing:.15em;color:#aaa;font-family:'DM Mono',monospace}
            .doc-meta{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:10px;margin-bottom:16px;padding:10px 0;border-top:1px solid #e8e4de;border-bottom:1px solid #e8e4de}
            .doc-meta-label{color:#aaa;margin-bottom:2px;font-family:'DM Mono',monospace;font-size:8px}
            .doc-meta-value{color:#222;font-weight:500;font-size:10px}
            .doc-table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:16px}
            .doc-table th{background:#7a1a1a;color:#fff;padding:7px 6px;text-align:left;font-weight:500}
            .doc-table td{padding:7px 6px;border-bottom:1px solid #f0ece6;vertical-align:middle}
            .col-name{word-break:break-all}
            .col-spec{font-size:9px;color:#666;white-space:nowrap}
            .col-price{text-align:center;font-family:'DM Mono',monospace;color:#555}
            .col-qty{text-align:center;font-family:'DM Mono',monospace}
            .col-sub{text-align:right;font-weight:600;color:#7a1a1a;font-family:'DM Mono',monospace}
            .doc-table tr:nth-child(even) td{background:#faf9f7}
            .doc-totals{margin-top:16px;padding-top:12px;border-top:2px solid #e8e4de}
            .doc-total-row{display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-bottom:5px}
            .doc-total-row span:first-child{color:#888}
            .doc-total-row span:last-child{font-family:'DM Mono',monospace;color:#333}
            .doc-total-row.grand{margin-top:8px;padding-top:8px;border-top:1px solid #e8e4de}
            .doc-total-row.grand span:first-child{font-size:12px;font-weight:600;color:#222}
            .doc-total-row.grand span:last-child{font-size:16px;font-weight:700;color:#7a1a1a}
            .doc-footer{margin-top:24px;text-align:center;padding-top:14px;border-top:1px solid #ede9e3}
            .doc-footer p{font-size:8px;color:#bbb;letter-spacing:.08em;font-family:'DM Mono',monospace;line-height:1.8}
            .doc-note{margin-top:12px;padding:8px 10px;background:#faf9f7;border-radius:4px;font-size:9px;color:#888;font-family:'DM Mono',monospace}
          `}} />
          <div className="doc-brand">
            <div className="doc-brand-name">柳 味 探 秘 科 技</div>
            <div className="doc-brand-sub">LIUWEI TECHNOLOGY · 餐饮供应链管理</div>
          </div>
          <div className="doc-heading">
            <h1>进 货 单</h1>
            <p>PURCHASE ORDER / RECEIPT</p>
          </div>
          <div className="doc-meta">
            <div><div className="doc-meta-label">NO.</div><div className="doc-meta-value">{batchNo}</div></div>
            <div><div className="doc-meta-label">日期</div><div className="doc-meta-value">{dateStr}</div></div>
            <div><div className="doc-meta-label">支付</div><div className="doc-meta-value">{batch.payment_method}</div></div>
          </div>
          <table className="doc-table" dangerouslySetInnerHTML={{ __html: `<thead><tr><th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>${rows}</tbody>` }} />
          <div className="doc-totals">
            <div className="doc-total-row"><span>商品种类</span><span>{itemCount} 种</span></div>
            <div className="doc-total-row"><span>总件数</span><span>{totalQty} 件</span></div>
            <div className="doc-total-row grand"><span>合计货款</span><span>{fmtMoney(batch.total)}</span></div>
          </div>
          {batch.note ? <div className="doc-note">📝 {batch.note}</div> : null}
          <div className="doc-footer">
            <p>{batch.operator ? `经办人：${batch.operator} · ` : ''}柳味探秘科技 · 餐饮供应链管理系统<br/>本单据由系统自动生成，具有法律效力</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px 8px', height: 72, background: 'rgba(20,20,22,.88)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
        <button style={toolBtn} onClick={() => { const a = document.createElement('a'); a.href = `/api/procurement-batches/${batchId}/pdf`; a.download = `procurement_${batchId}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}>⬇️ 下载</button>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.07)' }} />
        <button style={toolBtn} onClick={() => navigator.clipboard?.writeText(window.location.href)}>🔗 复制链接</button>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.07)' }} />
        <button style={toolBtn} onClick={() => window.print()}>🖨️ 打印</button>
      </div>
    </div>,
    document.body
  );
}

const toolBtn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
  border: 'none', background: 'none', flex: 1, maxWidth: 90,
  fontSize: 10, color: 'rgba(240,237,232,.28)',
};
