import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

const PAGE_SIZE = 10;

export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');
  const touchRef = useRef({ startX: 0, startY: 0 });
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showFilter, setShowFilter] = useState(false);
  const [filBillFrom, setFilBillFrom] = useState('');
  const [filBillTo, setFilBillTo] = useState('');
  const [filDateFrom, setFilDateFrom] = useState('');
  const [filDateTo, setFilDateTo] = useState('');
  const [filBy, setFilBy] = useState('');
  const [users, setUsers] = useState<{id: number; username: string}[]>([]);

  // Fetch users when filter panel opens
  useEffect(() => {
    if (showFilter && users.length === 0) {
      api.getUsers().then(data => setUsers(data || [])).catch(() => {});
    }
  }, [showFilter]);

  const buildFilters = useCallback(() => {
    const f: Record<string, string> = {};
    if (filBillFrom) f.bill_date_from = filBillFrom;
    if (filBillTo) f.bill_date_to = filBillTo;
    if (filDateFrom) f.date_from = filDateFrom;
    if (filDateTo) f.date_to = filDateTo;
    if (filBy) f.reconciled_by = filBy;
    return f;
  }, [filBillFrom, filBillTo, filDateFrom, filDateTo, filBy]);

  const resetFilters = () => {
    setFilBillFrom(''); setFilBillTo('');
    setFilDateFrom(''); setFilDateTo('');
    setFilBy('');
  };

  const loadData = useCallback(async () => {
    try {
      const filters = buildFilters();
      const data = await api.getReconciliations(0, filters);
      setRecords(data || []);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
  }, [buildFilters]);

  useEffect(() => { loadData(); }, [loadData]);

  const visible = records.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < records.length;

  const handleScroll = useCallback((e: any) => {
    if (!hasMore) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 120) {
      if (!scrollTimerRef.current) {
        scrollTimerRef.current = setTimeout(() => {
          scrollTimerRef.current = null;
          setPage(p => p + 1);
        }, 300);
      }
    }
  }, [hasMore]);

  const fmtDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const l = getLang();
    if (l.startsWith('en')) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  const fmtAmt = (n: number) => '\u00A5' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent?.touches?.[0] || e.nativeEvent;
    touchRef.current = { startX: t.pageX, startY: t.pageY };
  };
  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent?.changedTouches?.[0] || e.nativeEvent;
    const dx = t.pageX - touchRef.current.startX;
    const dy = Math.abs(t.pageY - touchRef.current.startY);
    if (touchRef.current.startX < 36 && dx > 80 && dx > dy * 1.5) onBack();
  };

  // Card: compact summary (tap to open detail modal)
  const renderCard = (r: any) => (
    <TouchableOpacity key={r.id} style={st.card} onPress={() => setSelected(r)} activeOpacity={0.7}>
      {/* Row 1: two dates */}
      <View style={st.dateRow}>
        <View style={st.dateItem}>
          <Text style={st.dateLabel}>{t('reconDate')}</Text>
          <Text style={st.dateVal}>{fmtDate(r.date)}</Text>
        </View>
        <View style={st.dateSep} />
        <View style={st.dateItem}>
          <Text style={st.dateLabel}>{t('billDate')}</Text>
          <Text style={st.dateVal}>{fmtDate(r.bill_date || r.date)}</Text>
        </View>
      </View>
      {/* Reconciler */}
      {r.reconciled_by ? (
        <View style={st.reconByRow}>
          <Text style={st.reconByText}>{t('reconciledBy')}: {r.reconciled_by}</Text>
        </View>
      ) : null}
      {/* Row 2: 3 vertical pair columns */}
      <View style={st.cardPairRow}>
        {/* Col 1: 账面余额 / 卡余额 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('bookBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.channel_total)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cardBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.card_balance)}</Text>
          </View>
        </View>
        {/* Col 2: 当前结余 / 现金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('currentBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.real_total)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cashBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.cash_balance)}</Text>
          </View>
        </View>
        {/* Col 3: 账面差额 / 在途资金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('bookDiff')}</Text>
            <Text style={[st.cardPairVal, { color: Math.abs(r.diff) < 0.005 ? '#059669' : '#DC2626' }]}>
              {r.diff >= 0 ? '+' : ''}{fmtAmt(Math.abs(r.diff))}
            </Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('fundsInTransit')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.channel_total)}</Text>
          </View>
        </View>
      </View>
      {/* Tap hint */}
      <Text style={st.tapHint}>{t('tapForDetail')}</Text>
    </TouchableOpacity>
  );

  // Detail Modal: three vertical pairs + channel list
  const renderModal = () => {
    if (!selected) return null;
    const r = selected;
    return (
      <View style={st.mask} onTouchStart={(e: any) => e.stopPropagation()}>
        <TouchableOpacity style={st.maskBg} activeOpacity={1} onPress={() => setSelected(null)} />
        <View style={st.modal}>
          {/* Header */}
          <View style={st.modalHeader}>
            <View>
              <Text style={st.modalDate}>{t('reconDate')}: {fmtDate(r.date)}</Text>
              <Text style={st.modalDateSub}>{t('billDate')}: {fmtDate(r.bill_date || r.date)}</Text>
              {r.reconciled_by ? (
                <Text style={st.modalDateSub}>{t('reconciledBy')}: {r.reconciled_by}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.6}>
              <Text style={st.modalClose}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
          {/* Three vertical pair groups */}
          <View style={st.pairRow}>
            {/* Group 1: 账面余额 / 卡余额 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('bookBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.channel_total)}</Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('cardBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.card_balance)}</Text>
              </View>
            </View>
            {/* Group 2: 当前结余 / 现金 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('currentBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.real_total)}</Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('cashBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.cash_balance)}</Text>
              </View>
            </View>
            {/* Group 3: 账面差额 / 在途资金 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('bookDiff')}</Text>
                <Text style={[st.pairVal, { color: Math.abs(r.diff) < 0.005 ? '#059669' : '#DC2626' }]}>
                  {r.diff >= 0 ? '+' : ''}{fmtAmt(Math.abs(r.diff))}
                </Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('fundsInTransit')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.channel_total)}</Text>
              </View>
            </View>
          </View>
          {/* Channel detail rows */}
          <View style={st.chanSection}>
            {[
              { label: t('dineIn'), value: r.dine_in },
              { label: t('meituan'), value: r.meituan },
              { label: t('flashSale'), value: r.flash_sale },
              { label: t('jd'), value: r.jd },
              { label: t('tuan'), value: r.tuan },
            ].map((ch, i) => (
              <View key={i} style={st.chanRow}>
                <Text style={st.chanLabel}>{ch.label}</Text>
                <Text style={st.chanVal}>{fmtAmt(ch.value)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={st.emptyWrap}>
      <View style={st.emptyIcon}><Text style={st.emptyEmoji}>{'\uD83D\uDCCB'}</Text></View>
      <Text style={st.emptyTitle}>{t('noRecords')}</Text>
      <Text style={st.emptyHint}>{t('emptyReconHint')}</Text>
    </View>
  );

  return (
    <View style={st.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Toast */}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
      {/* Back button */}
      <TouchableOpacity style={st.backFloat} onPress={onBack} activeOpacity={0.7}>
        <Text style={st.backFloatArrow}>{'\u2039'}</Text>
      </TouchableOpacity>
      {/* Header */}
      <View style={st.header}>
        <View style={{ width: 44 }} />
        <Text style={st.title}>{t('reconHistory')}</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => setShowFilter(!showFilter)} activeOpacity={0.7}>
          <Text style={[st.filterBtnText, showFilter && st.filterBtnTextActive]}>{t('filter')}</Text>
        </TouchableOpacity>
      </View>
      {/* Filter bar */}
      {showFilter && (
        <View style={st.filterPanel}>
          <View style={st.filterContent}>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('billDate')}</Text>
              <View style={st.filterDateRange}>
                <input type="date" value={filBillFrom} onChange={(e: any) => setFilBillFrom(e.target.value)}
                  style={st.filterDateInput as any} />
                <Text style={st.filterDateArrow}>→</Text>
                <input type="date" value={filBillTo} onChange={(e: any) => setFilBillTo(e.target.value)}
                  style={st.filterDateInput as any} />
              </View>
            </View>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconDate')}</Text>
              <View style={st.filterDateRange}>
                <input type="date" value={filDateFrom} onChange={(e: any) => setFilDateFrom(e.target.value)}
                  style={st.filterDateInput as any} />
                <Text style={st.filterDateArrow}>→</Text>
                <input type="date" value={filDateTo} onChange={(e: any) => setFilDateTo(e.target.value)}
                  style={st.filterDateInput as any} />
              </View>
            </View>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconciledBy')}</Text>
              <View style={st.filterSelectWrap}>
                <select value={filBy} onChange={(e: any) => setFilBy(e.target.value)}
                  style={st.filterSelect as any}>
                  <option value="">{t('any')}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.username}</option>
                  ))}
                </select>
                <Text style={st.filterSelectArrow}>▾</Text>
              </View>
            </View>
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.filterApplyBtn} onPress={() => setShowFilter(false)} activeOpacity={0.8}>
                <Text style={st.filterApplyBtnText}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {/* List */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={200}
        contentContainerStyle={{ paddingTop: 8 }}>
        {loading ? (
          <Text style={st.loading}>{t('loading')}</Text>
        ) : records.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {visible.map(renderCard)}
            {hasMore && <Text style={st.loadingMore}>{t('loading')}...</Text>}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      {/* Detail Modal */}
      {renderModal()}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  backFloat: {
    position: 'absolute', top: 14, left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(250,250,250,0.72)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(20px)',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)',
    // @ts-ignore
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  backFloatArrow: { fontSize: 22, fontWeight: '400', color: '#8B1E22', marginTop: -1, marginLeft: -1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '400', color: '#1A1A1A' },
  list: { flex: 1, paddingHorizontal: 12 },
  loading: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#999' },
  loadingMore: { textAlign: 'center', paddingVertical: 20, fontSize: 13, color: '#B0B0B0' },
  /* Card */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#EBEBEB',
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    gap: 10,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 8 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 9, color: '#B0B0B0', fontWeight: '500', marginBottom: 2 },
  dateVal: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dateSep: { width: 1, height: 24, backgroundColor: '#EBEBEB' },
  /* Card vertical pairs — plain, no background */
  cardPairRow: { flexDirection: 'row', gap: 4 },
  cardPairCol: { flex: 1, alignItems: 'center' },
  cardPairItem: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  cardPairLabel: { fontSize: 10, color: '#999', fontWeight: '500' },
  cardPairVal: { fontSize: 14, fontWeight: '700', color: '#374151' },
  cardPairDiv: { height: 1, backgroundColor: '#F3F4F6', width: '60%', marginVertical: 2 },
  tapHint: { fontSize: 10, color: '#C0C0C0', textAlign: 'center', marginTop: 2 },
  /* Modal */
  mask: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, justifyContent: 'center', alignItems: 'center',
  },
  maskBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,26,26,0.4)',
  },
  modal: {
    width: '88%', maxWidth: 380,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
    // @ts-ignore
    animationName: 'modalIn', animationDuration: '0.2s', animationTimingFunction: 'ease',
  },
  modalHeader: {
    backgroundColor: '#8B1E22',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 18,
  },
  modalDate: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  modalDateSub: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  modalClose: { fontSize: 18, fontWeight: '400', color: '#FFFFFF', paddingLeft: 8 },
  /* Three vertical pairs */
  pairRow: {
    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 10,
    gap: 6,
  },
  pairCol: {
    flex: 1, alignItems: 'center',
    backgroundColor: '#FAF7F2', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  pairItem: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  pairLabel: { fontSize: 10, color: '#999', fontWeight: '500' },
  pairVal: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  pairDivider: { height: 1, backgroundColor: '#E8E4DD', width: '70%' },
  /* Channel section */
  chanSection: {
    marginHorizontal: 14, marginBottom: 18, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  chanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 4 },
  chanLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chanVal: { fontSize: 14, fontWeight: '600', color: '#374151' },
  /* Empty state */
  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FAF7F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EBEBEB' },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#6B7280' },
  emptyHint: { fontSize: 13, color: '#B0B0B0', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  /* Filter — redesigned (Linear.app inspired) */
  filterBtn: {
    width: 44, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: { backgroundColor: '#8B1E22' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterBtnTextActive: { color: '#FFFFFF' },
  filterPanel: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#EBEBEB',
    // @ts-ignore
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  filterContent: {
    padding: 18, gap: 16,
  },
  filterField: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 12, fontWeight: '500', color: '#6B7280',
    letterSpacing: 0.3,
  },
  filterDateRange: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  filterDateInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1, borderColor: '#F0F0F0',
    fontSize: 13, fontWeight: '500', color: '#374151',
    fontFamily: 'inherit',
    outline: 'none',
  },
  filterDateArrow: {
    fontSize: 14, color: '#C0C0C0', fontWeight: '300',
  },
  filterInput: {
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1, borderColor: '#F0F0F0',
    fontSize: 13, fontWeight: '500', color: '#374151',
  },
  filterSelectWrap: {
    position: 'relative',
  },
  filterSelect: {
    width: '100%',
    height: 40,
    paddingLeft: 12,
    paddingRight: 34,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1, borderColor: '#F0F0F0',
    fontSize: 13, fontWeight: '500', color: '#374151',
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer',
  },
  filterSelectArrow: {
    position: 'absolute',
    right: 12, top: 11,
    fontSize: 12, color: '#9CA3AF', fontWeight: '700',
    pointerEvents: 'none',
  },
  filterActions: {
    flexDirection: 'row', gap: 10, paddingTop: 2,
  },
  filterResetBtn: {
    flex: 1, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  filterResetBtnText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterApplyBtn: {
    flex: 1, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#8B1E22',
  },
  filterApplyBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  /* Reconciler in card */
  reconByRow: { alignItems: 'center', paddingBottom: 2 },
  reconByText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
});
