import React, { useState, useEffect } from 'react';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

const partnerShare: Record<string, number> = { '张安武': 0.34, '江宽': 0.33, '蓝柳富': 0.33 };
const initCapital: Record<string, number> = { '张安武': 44200, '江宽': 42900, '蓝柳富': 42900 };

export default function PartnerScreen({ onBack }: { onBack: () => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [totalDiv, setTotalDiv] = useState(0);
  const [showDividend, setShowDividend] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showOrg, setShowOrg] = useState(false);
  const [divAmount, setDivAmount] = useState('');
  const [divNote, setDivNote] = useState('');
  const [filter, setFilter] = useState('all');
  const [lang, setLangState] = useState(getLang());

  const loadData = async () => {
    try {
      const p = await api.getPartners();
      setPartners(p || []);
      const d = await api.getDividends();
      setDividends(d || []);
      setTotalDiv((d || []).reduce((s: number, x: any) => s + x.amount, 0));
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

  // Group dividends by note
  const grouped: Record<string, any[]> = {};
  dividends.forEach((d: any) => {
    const n = d.note || '---';
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(d);
  });
  const groupKeys = Object.keys(grouped).reverse();

  const handleDividend = async () => {
    if (!divAmount) return;
    const amt = parseFloat(divAmount);
    const items = partners.map((p: any) => ({
      partner: p.name,
      amount: parseFloat((amt * (partnerShare[p.name] || 0.33)).toFixed(2)),
      note: divNote || `第${groupKeys.length + 1}次分红`,
    }));
    await api.createDividend({ items });
    setShowDividend(false);
    setDivAmount(''); setDivNote('');
    loadData();
  };

  const handleDelete = async (note: string) => {
    await api.deleteDividendByNote(note);
    loadData();
  };

  const switchLang = (l: string) => { setLang(l, loadData); setLangState(l); };

  return (
    <div style={{ backgroundColor: '#FAFAFA', minHeight: '100vh', fontFamily: 'Inter, Noto Sans SC, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 600, margin: '0 auto' }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{t('appTitle')}</h1>
          <p style={{ fontSize: 11, color: '#999' }}>{t('partnerSeats')}</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span onClick={onBack} style={{ fontSize: 12, color: '#8B1E22', cursor: 'pointer', padding: '4px 8px' }}>← {t('navHome')}</span>
          {langs.map(([l, label]) => (
            <span key={l} onClick={() => switchLang(l)}
              style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                color: lang === l ? '#8B1E22' : '#9CA3AF', fontWeight: lang === l ? 700 : 500,
                background: lang === l ? '#FEE2E2' : 'transparent' }}>{label}</span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 100px' }}>

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 10, border: '1px solid #EBEBEB', padding: 12 }}>
            <div style={{ fontSize: 10, color: '#999' }}>{t('totalCapital')}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#8B1E22', marginTop: 4 }}>¥130,000</div>
            <div style={{ fontSize: 9, color: '#10B981', marginTop: 2 }}>{t('paidInRate')} 100%</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 10, border: '1px solid #EBEBEB', padding: 12 }}>
            <div style={{ fontSize: 10, color: '#999' }}>{t('distributedPool')}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706', marginTop: 4 }}>¥{totalDiv.toLocaleString()}</div>
            <button onClick={() => setShowDividend(true)} style={{ marginTop: 6, background: '#8B1E22', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>{t('issueDividend')}</button>
          </div>
          <div onClick={() => setShowOrg(true)} style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 10, border: '1px solid #EBEBEB', padding: 12, cursor: 'pointer' }}>
            <div style={{ fontSize: 10, color: '#999' }}>{t('partnerSeats')}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>3 {t('shareholders')}</div>
            <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>{t('lpStructure')}</div>
          </div>
        </div>

        {/* Partner Cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {partners.map((p: any) => (
            <div key={p.id} onClick={() => setShowDetail(p)}
              style={{ flex: 1, minWidth: 160, background: '#fff', borderRadius: 10, border: '1px solid #EBEBEB', padding: 12, cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{p.name}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8B1E22', marginTop: 2 }}>{Math.round(p.share * 100)}%</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                {t('invest')} ¥{p.investment?.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#D97706', marginTop: 1 }}>
                {t('dividend')} +¥{p.total_dividends?.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Capital Ledger */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#999', padding: '8px 0' }}>{t('capitalLedger')}</div>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>{t('byRoundAndInvest')}</div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['all', 'invest', 'mid', 'dividend'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: filter === f ? 700 : 500,
                border: 'none', cursor: 'pointer',
                color: filter === f ? '#fff' : '#999',
                background: filter === f ? '#1A1A1A' : '#F3F4F6',
              }}>{t(f)}</button>
          ))}
        </div>

        {/* Initial Capital */}
        {(filter === 'all' || filter === 'invest') && (
          <TableGroup title="初始出资 · 2024年4月" type="invest" total={130000}
            items={[
              { name: '张安武', sub: '34%', amount: 44200 },
              { name: '蓝柳富', sub: '33%', amount: 42900 },
              { name: '江宽', sub: '33%', amount: 42900 },
            ]} />
        )}

        {/* Mid Investment */}
        {(filter === 'all' || filter === 'mid') && (
          <TableGroup title="追加 · 2025年1月21日" type="mid" total={30162}
            items={[
              { name: '张安武', sub: '34%', amount: 10255.08 },
              { name: '蓝柳富', sub: '33%', amount: 9953.46 },
              { name: '江宽', sub: '33%', amount: 9953.46 },
            ]} />
        )}

        {/* Dividend Rounds */}
        {(filter === 'all' || filter === 'dividend') && groupKeys.map(note => {
          const items = grouped[note];
          const total = items.reduce((s: number, d: any) => s + d.amount, 0);
          return (
            <TableGroup key={note} title={note} type="dividend" total={total}
              items={items.map((d: any) => ({ name: d.partner, sub: '', amount: d.amount }))}
              onDelete={() => handleDelete(note)} />
          );
        })}

        {/* Org Chart Modal */}
        {showOrg && (
          <div onClick={() => setShowOrg(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 280, overflow: 'hidden', textAlign: 'center' }}>
              <div style={{ background: '#8B1E22', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t('partnerSeats')}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{t('lpStructure')}</div>
                </div>
                <span onClick={() => setShowOrg(false)} style={{ color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 16 }}>✕</span>
              </div>
              <div style={{ padding: 16 }}>
                {[
                  { name: '张安武', role: 'chairman', pct: '34%' },
                  { name: '江宽', role: 'ceo', pct: '33%' },
                  { name: '蓝柳富', role: 'janitor', pct: '33%' },
                ].map(({ name, pct }, i) => (
                  <div key={name}>
                    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8B1E22' }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#999' }}>{pct}</div>
                    </div>
                    {i < 2 && <div style={{ width: 1, height: 12, background: '#D1D5DB', margin: '0 auto' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dividend Modal */}
        {showDividend && (
          <div onClick={() => setShowDividend(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 280, overflow: 'hidden' }}>
              <div style={{ background: '#8B1E22', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t('issueDividend')}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{t('cumulativeByShare')}</div>
                </div>
                <span onClick={() => setShowDividend(false)} style={{ color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 16 }}>✕</span>
              </div>
              <div style={{ padding: 16 }}>
                <input type="number" placeholder="总金额" value={divAmount} onChange={e => setDivAmount((e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #EBEBEB', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
                <input placeholder="备注 (如: 第6次分红)" value={divNote} onChange={e => setDivNote((e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #EBEBEB', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
                <button onClick={handleDividend}
                  style={{ width: '100%', padding: '10px', background: '#8B1E22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Partner Detail Modal */}
        {showDetail && (
          <div onClick={() => setShowDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 300, maxHeight: '80vh', overflow: 'auto' }}>
              <div style={{ background: '#8B1E22', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{showDetail.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{(showDetail.share * 100).toFixed(0)}%</div>
                </div>
                <span onClick={() => setShowDetail(null)} style={{ color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 16 }}>✕</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#F9FAFB', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#999' }}>{t('invest')}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>¥{showDetail.investment?.toLocaleString()}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#FFFBEB', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#999' }}>{t('dividend')}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>¥{showDetail.total_dividends?.toLocaleString()}</div>
                  </div>
                </div>
                {/* Payback progress */}
                {showDetail.investment > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#999', marginBottom: 4 }}>
                      <span>{t('paidInRate')}</span>
                      <span>{Math.min(100, Math.round(showDetail.total_dividends / showDetail.investment * 100))}%</span>
                    </div>
                    <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#D97706', borderRadius: 2,
                        width: `${Math.min(100, showDetail.total_dividends / showDetail.investment * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function TableGroup({ title, type, total, items, onDelete }: {
  title: string; type: string; total: number; items: { name: string; sub: string; amount: number }[];
  onDelete?: () => void;
}) {
  const colors: Record<string, { dot: string; headerBg: string; amt: string }> = {
    invest: { dot: '#3B82F6', headerBg: '#EFF6FF', amt: '#1A1A1A' },
    mid: { dot: '#8B5CF6', headerBg: '#F5F3FF', amt: '#1A1A1A' },
    dividend: { dot: '#F59E0B', headerBg: '#FFFBEB', amt: '#D97706' },
  };
  const c = colors[type] || colors.invest;

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #EBEBEB', overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: c.headerBg, borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: c.dot }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.amt }}>¥{total.toLocaleString()}</span>
          {onDelete && (
            <button onClick={onDelete} style={{ fontSize: 10, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
          )}
        </div>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
          <span style={{ fontSize: 12, color: '#666' }}>{item.name}{item.sub ? <span style={{ color: '#999', fontSize: 10 }}> · {item.sub}</span> : ''}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.amt }}>¥{item.amount.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
