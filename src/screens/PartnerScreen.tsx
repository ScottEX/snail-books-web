import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

const partnerShare: Record<string, number> = { '张安武': 0.34, '江宽': 0.33, '蓝柳富': 0.33 };
const initCapital: Record<string, number> = { '张安武': 44200, '江宽': 42900, '蓝柳富': 42900 };

export default function PartnerScreen({ onBack }: { onBack: () => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [totalDiv, setTotalDiv] = useState(0);
  const [showDividend, setShowDividend] = useState(false);
  const [showDelete, setShowDelete] = useState<any>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showOrg, setShowOrg] = useState(false);
  const [divAmount, setDivAmount] = useState('');
  const [divNote, setDivNote] = useState('');
  const [divPreview, setDivPreview] = useState<any[]>([]);
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

  const grouped: Record<string, any[]> = {};
  dividends.forEach((d: any) => {
    const n = d.note || '---';
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(d);
  });
  const groupKeys = Object.keys(grouped).reverse();

  const calcPreview = (total: number) => {
    setDivPreview(partners.map((p: any) => ({
      name: p.name,
      share: (partnerShare[p.name] || 0.33) * 100,
      amount: parseFloat((total * (partnerShare[p.name] || 0.33)).toFixed(2)),
    })));
  };

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
    setDivAmount(''); setDivNote(''); setDivPreview([]);
    loadData();
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    await api.deleteDividendByNote(showDelete);
    setShowDelete(null);
    loadData();
  };

  const switchLang = (l: string) => { setLang(l, loadData); setLangState(l); };

  const roles: Record<string, string> = { '张安武': '董事长', '江宽': 'CEO', '蓝柳富': '打杂' };

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.container}>

          {/* ====== HEADER (8600 exact) ====== */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={onBack} style={s.backLink} accessibilityRole="link">
                <Text style={s.backArrow}>‹</Text>
                <Text style={s.backText}>{t('backHome')}</Text>
              </TouchableOpacity>
              <View style={s.titleRow}>
                <View style={s.redBar} />
                <View>
                  <Text style={s.mainTitle}>{t('partnerTitle')}</Text>
                  <Text style={s.engSub}>Lan's Luosifen · Partner Capital</Text>
                </View>
              </View>
            </View>
            <View style={s.langRow}>
              {langs.map(([l, label]) => (
                <TouchableOpacity key={l} onPress={() => switchLang(l)}>
                  <Text style={[s.langBtn, lang === l && s.langActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ====== 3 STAT CARDS (8600 exact layout) ====== */}
          <View style={s.statGrid}>
            {/* Card 1: 初始基金 */}
            <View style={s.statCard}>
              <View style={[s.statIconBg, { backgroundColor: 'rgba(139,30,34,0.08)' }]}>
                <Text style={s.statIcon}>🏛</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('totalCapital')}</Text>
                <Text style={s.statValue}>¥130,000</Text>
                <Text style={s.statGreen}>{t('paidInRate')} 100%</Text>
              </View>
            </View>

            {/* Card 2: 分红池 */}
            <View style={s.statCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View style={[s.statIconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={s.statIcon}>💰</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.statLabel}>{t('distributedPool')}</Text>
                  <Text style={[s.statValue, { color: '#D97706' }]}>¥{totalDiv.toLocaleString()}</Text>
                  <Text style={s.statSub}>{t('cumulativeByShare')}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.dividendBtn} onPress={() => setShowDividend(true)}>
                <Text style={s.dividendBtnText}>{t('issueDividend')}</Text>
              </TouchableOpacity>
            </View>

            {/* Card 3: 合伙席位 */}
            <TouchableOpacity style={s.statCard} onPress={() => setShowOrg(true)}>
              <View style={[s.statIconBg, { backgroundColor: '#F3F4F6' }]}>
                <Text style={s.statIcon}>👥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('partnerSeats')}</Text>
                <Text style={[s.statValue, { color: '#1F2937' }]}>3 {t('shareholders')}</Text>
                <Text style={s.statSub}>{t('lpStructure')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ====== PARTNER CARDS ====== */}
          <View style={s.partnerGrid}>
            {partners.map((p: any) => (
              <TouchableOpacity key={p.id} style={s.partnerCard} onPress={() => setShowDetail(p)}>
                <View style={s.partnerHeader}>
                  <Text style={s.partnerName}>{p.name}</Text>
                  <Text style={s.partnerPct}>{Math.round(p.share * 100)}%</Text>
                  <View style={s.paidBadge}>
                    <Text style={s.paidBadgeText}>出资完结</Text>
                  </View>
                </View>
                <View style={s.partnerDataRow}>
                  <View style={s.partnerDataCell}>
                    <Text style={s.dataLabel}>认缴总额</Text>
                    <Text style={s.dataValue}>¥{(initCapital[p.name] || 0).toLocaleString()}</Text>
                  </View>
                  <View style={s.partnerDataCell}>
                    <Text style={s.dataLabel}>初始</Text>
                    <Text style={s.dataValue}>¥{(initCapital[p.name] || 0).toLocaleString()}</Text>
                  </View>
                  <View style={s.partnerDataCell}>
                    <Text style={s.dataLabel}>追加</Text>
                    <Text style={s.dataValue}>¥{(p.investment - initCapital[p.name]).toLocaleString()}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ====== CAPITAL LEDGER ====== */}
          <View style={s.ledgerCard}>
            <View style={s.ledgerHeader}>
              <View>
                <Text style={s.ledgerTitle}>{t('capitalLedger')}</Text>
                <Text style={s.ledgerSub}>{t('byRoundAndInvest')}</Text>
              </View>
              <View style={s.filterRow}>
                {(['all', 'invest', 'mid', 'dividend'] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setFilter(f)}
                    style={[s.filterBtn, filter === f && s.filterBtnActive]}>
                    <Text style={[s.filterBtnText, filter === f && s.filterBtnActiveText]}>{t(f)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
                  onDelete={() => setShowDelete(note)} />
              );
            })}
          </View>

        </View>
      </ScrollView>

      {/* ====== DIVIDEND MODAL ====== */}
      {showDividend && (
        <ModalOverlay onClose={() => setShowDividend(false)}>
          <ModalHeader title={t('issueProportional')} sub={t('autoByShare')} onClose={() => setShowDividend(false)} />
          <View style={ms.body}>
            <Text style={ms.label}>{t('totalToPool')}</Text>
            <TextInput style={ms.input} placeholder={t('enterAmount')} value={divAmount}
              onChangeText={(v) => { setDivAmount(v); calcPreview(parseFloat(v) || 0); }}
              keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <Text style={ms.label}>{t('roundNote')}</Text>
            <TextInput style={ms.input} placeholder={t('roundNoteExample')} value={divNote}
              onChangeText={setDivNote} placeholderTextColor="#9CA3AF" />
            {divPreview.length > 0 && (
              <View style={ms.preview}>
                <Text style={ms.previewTitle}>{t('shareCalcResult')}</Text>
                {divPreview.map((item: any) => (
                  <View key={item.name} style={ms.previewRow}>
                    <Text style={ms.previewName}>{item.name} ({item.share.toFixed(0)}%)</Text>
                    <Text style={ms.previewAmt}>¥{item.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={ms.btnRow}>
              <TouchableOpacity style={ms.cancelBtn} onPress={() => setShowDividend(false)}>
                <Text style={ms.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.confirmBtn} onPress={handleDividend}>
                <Text style={ms.confirmBtnText}>{t('confirmIssue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== DELETE MODAL ====== */}
      {showDelete !== null && (
        <ModalOverlay onClose={() => setShowDelete(null)}>
          <ModalHeader title={t('confirmDeleteRecord')} sub={t('irreversible')} onClose={() => setShowDelete(null)} />
          <View style={ms.body}>
            <View style={ms.deleteBox}>
              <Text style={ms.deleteText}>{t('willDelete')}「<Text style={{ fontWeight: '600' }}>{showDelete}</Text>」{t('allDividendRecords')}</Text>
            </View>
            <View style={ms.btnRow}>
              <TouchableOpacity style={ms.cancelBtn} onPress={() => setShowDelete(null)}>
                <Text style={ms.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.confirmBtn, { backgroundColor: '#EF4444' }]} onPress={handleDelete}>
                <Text style={ms.confirmBtnText}>{t('confirmDeleteRecord')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== PARTNER DETAIL MODAL ====== */}
      {showDetail && (
        <ModalOverlay onClose={() => setShowDetail(null)}>
          <View style={[ms.modal, { width: 320 }]}>
            <ModalHeader
              title={showDetail.name}
              sub={`${roles[showDetail.name] || ''} · ${t('sharePercent')} ${(showDetail.share * 100).toFixed(0)}%`}
              onClose={() => setShowDetail(null)} />
            <View style={ms.body}>
              <View style={ds.grid}>
                <View style={ds.cell}>
                  <Text style={ds.cellLabel}>{t('totalInvest')}</Text>
                  <Text style={ds.cellNum}>¥{(showDetail.investment || 0).toLocaleString()}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={ds.cellLabel}>{t('dividend')}</Text>
                  <Text style={[ds.cellNum, { color: '#D97706' }]}>¥{(showDetail.total_dividends || 0).toLocaleString()}</Text>
                </View>
                <View style={ds.cell}>
                  <Text style={ds.cellLabel}>初始</Text>
                  <Text style={ds.cellNum}>¥{(initCapital[showDetail.name] || 0).toLocaleString()}</Text>
                </View>
                <View style={ds.cell}>
                  <Text style={ds.cellLabel}>追加</Text>
                  <Text style={ds.cellNum}>¥{((showDetail.investment || 0) - (initCapital[showDetail.name] || 0)).toLocaleString()}</Text>
                </View>
              </View>
              {showDetail.investment > 0 && (
                <View>
                  <View style={ds.progressLabel}>
                    <Text style={ds.progressLabelText}>{t('paidInRate')}</Text>
                    <Text style={ds.progressLabelText}>
                      {Math.min(100, Math.round((showDetail.total_dividends || 0) / showDetail.investment * 100))}%
                    </Text>
                  </View>
                  <View style={ds.progressBar}>
                    <View style={[ds.progressFill, {
                      width: `${Math.min(100, ((showDetail.total_dividends || 0) / showDetail.investment * 100))}%` as any,
                    }]} />
                  </View>
                </View>
              )}
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== ORG CHART MODAL ====== */}
      {showOrg && (
        <ModalOverlay onClose={() => setShowOrg(false)}>
          <ModalHeader title={t('partnerSeats')} sub={t('lpStructure')} onClose={() => setShowOrg(false)} />
          <View style={{ padding: 16, alignItems: 'center' }}>
            {[
              { name: '张安武', role: 'chairman', pct: '34%' },
              { name: '江宽', role: 'ceo', pct: '33%' },
              { name: '蓝柳富', role: 'janitor', pct: '33%' },
            ].map(({ name, pct }, i) => (
              <View key={name} style={{ alignItems: 'center' }}>
                <View style={os.card}>
                  <Text style={os.name}>{name}</Text>
                  <Text style={os.pct}>{pct}</Text>
                </View>
                {i < 2 && <View style={os.line} />}
              </View>
            ))}
          </View>
        </ModalOverlay>
      )}
    </View>
  );
}

/* ========== MODAL COMPONENTS ========== */

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={mo.overlay}>
      <TouchableOpacity style={mo.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={[mo.content, (children as any)?.type === ModalHeader ? {} : {}]}>
        {children}
      </View>
    </View>
  );
}

function ModalHeader({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <View style={mo.header}>
      <View>
        <Text style={mo.title}>{title}</Text>
        <Text style={mo.sub}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onClose}>
        <Text style={mo.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ========== TABLE GROUP ========== */

function TableGroup({ title, type, total, items, onDelete }: {
  title: string; type: string; total: number; items: { name: string; sub: string; amount: number }[];
  onDelete?: () => void;
}) {
  const colors: Record<string, { dot: string; headerBg: string; headerColor: string; badge: string; amt: string }> = {
    invest: { dot: '#3B82F6', headerBg: '#EFF6FF', headerColor: '#1F2937', badge: '#3B82F6', amt: '#111827' },
    mid: { dot: '#8B5CF6', headerBg: '#F5F3FF', headerColor: '#1F2937', badge: '#8B5CF6', amt: '#111827' },
    dividend: { dot: '#F59E0B', headerBg: '#FFFBEB', headerColor: '#1F2937', badge: '#F59E0B', amt: '#D97706' },
  };
  const c = colors[type] || colors.invest;
  const typeLabel: Record<string, string> = { invest: t('invest'), mid: t('mid'), dividend: t('dividend') };

  return (
    <View style={tg.card}>
      {/* Table Header */}
      <View style={[tg.theadRow, { backgroundColor: c.headerBg }]}>
        <View style={[tg.thLeft, { flex: 1 }]}>
          <View style={[tg.dot, { backgroundColor: c.dot }]} />
          <Text style={[tg.thTitle, { color: c.headerColor }]}>{title}</Text>
        </View>
        <View style={tg.thMid}>
          <Text style={[tg.thBadge, { color: c.badge }]}>{typeLabel[type] || ''}</Text>
        </View>
        <View style={tg.thRight}>
          <Text style={[tg.thAmt, { color: c.amt }]}>¥{total.toLocaleString()}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginLeft: 8 }}>
              <Text style={tg.delBtn}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Table Body */}
      {items.map((item, i) => (
        <View key={i} style={[tg.tbodyRow, i > 0 && tg.rowBorder]}>
          <Text style={[tg.tdName, { flex: 1, paddingLeft: 16 }]}>{item.name}
            {item.sub ? <Text style={tg.tdSub}> · {item.sub}</Text> : null}
          </Text>
          <View style={tg.tdMid} />
          <Text style={[tg.tdAmt, { color: c.amt }]}>¥{item.amount.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

/* ========== STYLES ========== */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { flex: 1 },
  container: { maxWidth: 1024, alignSelf: 'center', width: '100%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 64 },

  // Header (matching 8600 partner.html)
  header: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backArrow: { fontSize: 22, color: '#9CA3AF', lineHeight: 22, fontWeight: '300' },
  backText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redBar: { width: 8, height: 36, backgroundColor: '#8B1E22', borderRadius: 100 },
  mainTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 },
  engSub: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.5, marginTop: 2 },
  langRow: { flexDirection: 'row', gap: 4, paddingTop: 4 },
  langBtn: { fontSize: 10, color: '#9CA3AF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, fontWeight: '500' as any },
  langActive: { color: '#8B1E22', backgroundColor: '#FEE2E2', fontWeight: '700' as any },

  // Stat Cards (8600: grid-cols-3 gap-3)
  statGrid: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  statIconBg: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statIcon: { fontSize: 18 },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.3 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
  statGreen: { fontSize: 9, color: '#059669', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  dividendBtn: { backgroundColor: '#8B1E22', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  dividendBtnText: { color: '#fff', fontSize: 10, fontWeight: '500' },

  // Partner Cards (8600: grid-cols-3)
  partnerGrid: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  partnerCard: {
    flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
    padding: 16, gap: 10,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partnerName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  partnerPct: { fontSize: 10, color: '#9CA3AF' },
  paidBadge: { backgroundColor: '#ECFDF5', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  paidBadgeText: { fontSize: 9, fontWeight: '500', color: '#059669' },
  partnerDataRow: { flexDirection: 'row', gap: 4 },
  partnerDataCell: { flex: 1, alignItems: 'center' },
  dataLabel: { fontSize: 9, color: '#9CA3AF' },
  dataValue: { fontSize: 10, fontWeight: '600', color: '#111827' },

  // Ledger Card (8600: rounded-2xl white card)
  ledgerCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', marginTop: 16,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  ledgerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  ledgerTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  ledgerSub: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#1F2937' },
  filterBtnText: { fontSize: 10, fontWeight: '500' as any, color: '#6B7280' },
  filterBtnActiveText: { color: '#fff', fontWeight: '700' as any },
});

/* Modal Overlay Styles */
const mo = StyleSheet.create({
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'center', alignItems: 'center', padding: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26,26,26,0.4)' },
  content: { backgroundColor: '#fff', borderRadius: 16, width: 360, maxWidth: '100%', overflow: 'hidden' },
  header: { backgroundColor: '#8B1E22', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  close: { color: 'rgba(255,255,255,0.7)', fontSize: 18 },
});

/* Modal Body Styles */
const ms = StyleSheet.create({
  modal: { backgroundColor: '#fff', borderRadius: 16, width: 360, maxWidth: '100%', overflow: 'hidden' },
  body: { padding: 20, gap: 12 },
  label: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  input: { width: '100%', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, fontSize: 12, fontWeight: '600' as any, color: '#1A1A1A', fontFamily: undefined },
  preview: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 8 },
  previewTitle: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewName: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  previewAmt: { fontSize: 11, fontWeight: '700', color: '#1F2937' },
  btnRow: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  confirmBtn: { flex: 1, backgroundColor: '#8B1E22', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  confirmBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
  deleteBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, alignItems: 'center' },
  deleteText: { fontSize: 12, color: '#6B7280' },
});

/* Detail Modal Styles */
const ds = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%' as any, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  cellLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  cellNum: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, marginTop: 4 },
  progressLabelText: { fontSize: 10, color: '#9CA3AF' },
  progressBar: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#D97706', borderRadius: 2 },
});

/* Org Chart Styles */
const os = StyleSheet.create({
  card: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  name: { fontSize: 13, fontWeight: '700', color: '#8B1E22' },
  pct: { fontSize: 10, color: '#9CA3AF' },
  line: { width: 1, height: 12, backgroundColor: '#D1D5DB' },
});

/* Table Group Styles */
const tg = StyleSheet.create({
  card: { borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  // Table header row
  theadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  thLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  thTitle: { fontSize: 12, fontWeight: '600' },
  thMid: { width: 40, alignItems: 'center' },
  thBadge: { fontSize: 11, fontWeight: '600' },
  thRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  thAmt: { fontSize: 12, fontWeight: '700' },
  delBtn: { fontSize: 10, color: '#EF4444' },
  // Table body rows
  tbodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  tdName: { fontSize: 12, color: '#4B5563' },
  tdSub: { fontSize: 10, color: '#9CA3AF' },
  tdMid: { width: 40 },
  tdAmt: { fontSize: 12, fontWeight: '600', paddingRight: 16 },
});
