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
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('appTitle')}</Text>
          <Text style={s.headerSub}>{t('partnerSeats')}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={onBack}>
            <Text style={s.backBtn}>← {t('navHome')}</Text>
          </TouchableOpacity>
          {langs.map(([l, label]) => (
            <TouchableOpacity key={l} onPress={() => switchLang(l)}>
              <Text style={[s.langBtn, lang === l && s.langActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.content}>

          {/* Stat Cards */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>{t('totalCapital')}</Text>
              <Text style={[s.statNum, { color: '#8B1E22' }]}>¥130,000</Text>
              <Text style={s.statGreen}>{t('paidInRate')} 100%</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>{t('distributedPool')}</Text>
              <Text style={[s.statNum, { color: '#D97706' }]}>¥{totalDiv.toLocaleString()}</Text>
              <TouchableOpacity style={s.dividendBtn} onPress={() => setShowDividend(true)}>
                <Text style={s.dividendBtnText}>{t('issueDividend')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.statCard} onPress={() => setShowOrg(true)}>
              <Text style={s.statLabel}>{t('partnerSeats')}</Text>
              <Text style={s.statNum}>3 {t('shareholders')}</Text>
              <Text style={s.statSub}>{t('lpStructure')}</Text>
            </TouchableOpacity>
          </View>

          {/* Partner Cards */}
          <View style={s.partnerRow}>
            {partners.map((p: any) => (
              <TouchableOpacity key={p.id} style={s.partnerCard} onPress={() => setShowDetail(p)}>
                <Text style={s.partnerName}>{p.name}</Text>
                <Text style={s.partnerPct}>{Math.round(p.share * 100)}%</Text>
                <Text style={s.partnerInvest}>{t('invest')} ¥{p.investment?.toLocaleString()}</Text>
                <Text style={s.partnerDiv}>{t('dividend')} +¥{p.total_dividends?.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Capital Ledger */}
          <Text style={s.sectionTitle}>{t('capitalLedger')}</Text>
          <Text style={s.sectionSub}>{t('byRoundAndInvest')}</Text>

          {/* Filter buttons */}
          <View style={s.filterRow}>
            {(['all', 'invest', 'mid', 'dividend'] as const).map(f => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}
                style={[s.filterBtn, filter === f && s.filterBtnActive]}>
                <Text style={[s.filterBtnText, filter === f && s.filterBtnActiveText]}>{t(f)}</Text>
              </TouchableOpacity>
            ))}
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
                onDelete={() => handleDelete(note)} />
            );
          })}
        </View>
      </ScrollView>

      {/* Org Chart Modal */}
      {showOrg && (
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBack} onPress={() => setShowOrg(false)} activeOpacity={1}>
            <View style={s.modal} onStartShouldSetResponder={() => true}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{t('partnerSeats')}</Text>
                  <Text style={s.modalSub}>{t('lpStructure')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowOrg(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.modalBody}>
                {[
                  { name: '张安武', role: 'chairman', pct: '34%' },
                  { name: '江宽', role: 'ceo', pct: '33%' },
                  { name: '蓝柳富', role: 'janitor', pct: '33%' },
                ].map(({ name, pct }, i) => (
                  <View key={name}>
                    <View style={s.orgCard}>
                      <Text style={s.orgName}>{name}</Text>
                      <Text style={s.orgPct}>{pct}</Text>
                    </View>
                    {i < 2 && <View style={s.orgLine} />}
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Dividend Modal */}
      {showDividend && (
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBack} onPress={() => setShowDividend(false)} activeOpacity={1}>
            <View style={s.modal} onStartShouldSetResponder={() => true}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{t('issueDividend')}</Text>
                  <Text style={s.modalSub}>{t('cumulativeByShare')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDividend(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.modalBody}>
                <TextInput style={s.modalInput} placeholder="总金额" value={divAmount}
                  onChangeText={setDivAmount} keyboardType="decimal-pad" placeholderTextColor="#999" />
                <TextInput style={s.modalInput} placeholder="备注 (如: 第6次分红)" value={divNote}
                  onChangeText={setDivNote} placeholderTextColor="#999" />
                <TouchableOpacity style={s.modalConfirm} onPress={handleDividend}>
                  <Text style={s.modalConfirmText}>确认</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Partner Detail Modal */}
      {showDetail && (
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBack} onPress={() => setShowDetail(null)} activeOpacity={1}>
            <View style={[s.modal, { width: 300 }]} onStartShouldSetResponder={() => true}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{showDetail.name}</Text>
                  <Text style={s.modalSub}>{(showDetail.share * 100).toFixed(0)}%</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDetail(null)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={s.modalBody}>
                  <View style={s.detailGrid}>
                    <View style={[s.detailCell, { backgroundColor: '#F9FAFB' }]}>
                      <Text style={s.detailCellLabel}>{t('invest')}</Text>
                      <Text style={s.detailCellNum}>¥{showDetail.investment?.toLocaleString()}</Text>
                    </View>
                    <View style={[s.detailCell, { backgroundColor: '#FFFBEB' }]}>
                      <Text style={s.detailCellLabel}>{t('dividend')}</Text>
                      <Text style={[s.detailCellNum, { color: '#D97706' }]}>¥{showDetail.total_dividends?.toLocaleString()}</Text>
                    </View>
                  </View>
                  {showDetail.investment > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <View style={s.progressLabel}>
                        <Text style={{ fontSize: 10, color: '#999' }}>{t('paidInRate')}</Text>
                        <Text style={{ fontSize: 10, color: '#999' }}>
                          {Math.min(100, Math.round(showDetail.total_dividends / showDetail.investment * 100))}%
                        </Text>
                      </View>
                      <View style={s.progressBar}>
                        <View style={[s.progressFill, {
                          width: `${Math.min(100, showDetail.total_dividends / showDetail.investment * 100)}%` as any,
                        }]} />
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    <View style={tg.card}>
      <View style={[tg.header, { backgroundColor: c.headerBg }]}>
        <View style={tg.headerLeft}>
          <View style={[tg.dot, { backgroundColor: c.dot }]} />
          <Text style={tg.headerTitle}>{title}</Text>
        </View>
        <View style={tg.headerRight}>
          <Text style={[tg.headerAmt, { color: c.amt }]}>¥{total.toLocaleString()}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete}>
              <Text style={tg.deleteBtn}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={[tg.row, i > 0 && tg.rowBorder]}>
          <Text style={tg.rowName}>{item.name}{item.sub ? <Text style={tg.rowSub}> · {item.sub}</Text> : ''}</Text>
          <Text style={[tg.rowAmt, { color: c.amt }]}>¥{item.amount.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: 600, alignSelf: 'center', width: '100%' },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  headerSub: { fontSize: 11, color: '#999' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { fontSize: 12, color: '#8B1E22', fontWeight: '500', paddingVertical: 4, paddingHorizontal: 8 },
  langBtn: { fontSize: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, color: '#9CA3AF', fontWeight: '500' as any },
  langActive: { color: '#8B1E22', backgroundColor: '#FEE2E2', fontWeight: '700' as any },
  scroll: { flex: 1 },
  content: { maxWidth: 600, alignSelf: 'center', width: '100%', paddingHorizontal: 16, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', padding: 12 },
  statLabel: { fontSize: 10, color: '#999' },
  statNum: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  statGreen: { fontSize: 9, color: '#10B981', marginTop: 2 },
  statSub: { fontSize: 9, color: '#999', marginTop: 2 },
  dividendBtn: { marginTop: 6, backgroundColor: '#8B1E22', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start' },
  dividendBtnText: { color: '#fff', fontSize: 10 },
  partnerRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  partnerCard: { flex: 1, minWidth: 160, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', padding: 12 },
  partnerName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  partnerPct: { fontSize: 24, fontWeight: '700', color: '#8B1E22', marginTop: 2 },
  partnerInvest: { fontSize: 10, color: '#999', marginTop: 4 },
  partnerDiv: { fontSize: 10, color: '#D97706', marginTop: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#999', paddingVertical: 8 },
  sectionSub: { fontSize: 10, color: '#999', marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#1A1A1A' },
  filterBtnText: { fontSize: 10, fontWeight: '500' as any, color: '#999' },
  filterBtnActiveText: { color: '#fff', fontWeight: '700' as any },
  // Modals
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, justifyContent: 'center', alignItems: 'center' },
  overlayBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 12, width: 280, overflow: 'hidden' },
  modalHeader: { backgroundColor: '#8B1E22', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  modalClose: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  modalBody: { padding: 16 },
  modalInput: { width: '100%', paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 8, fontSize: 14, marginBottom: 10, color: '#1A1A1A', fontFamily: undefined },
  modalConfirm: { width: '100%', paddingVertical: 10, backgroundColor: '#8B1E22', borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Detail
  detailGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detailCell: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 8 },
  detailCellLabel: { fontSize: 9, color: '#999' },
  detailCellNum: { fontSize: 16, fontWeight: '700' },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressBar: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#D97706', borderRadius: 2 },
  // Org chart
  orgCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  orgName: { fontSize: 13, fontWeight: '700', color: '#8B1E22' },
  orgPct: { fontSize: 10, color: '#999' },
  orgLine: { width: 1, height: 12, backgroundColor: '#D1D5DB', alignSelf: 'center' },
});

const tg = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', overflow: 'hidden', marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  headerTitle: { fontSize: 12, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAmt: { fontSize: 13, fontWeight: '700' },
  deleteBtn: { fontSize: 10, color: '#EF4444' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowName: { fontSize: 12, color: '#666' },
  rowSub: { color: '#999', fontSize: 10 },
  rowAmt: { fontSize: 12, fontWeight: '600' },
});
