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

  const loadData = useCallback(async () => {
    try {
      const data = await api.getReconciliations(0);
      setRecords(data || []);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
  }, []);

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
  const fmtInt = (n: number) => '\u00A5' + n.toLocaleString();

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
      {/* Row 1: date */}
      <View style={st.dateRow}>
        <Text style={st.dateIcon}>{'\uD83D\uDCC5'}</Text>
        <Text style={st.dateText}>{fmtDate(r.date)}</Text>
      </View>
      {/* Row 2: 3-column summary */}
      <View style={st.summaryRow}>
        <View style={st.sumCol}>
          <Text style={st.sumLabel}>{t('bookBalance')}</Text>
          <Text style={st.sumVal}>{fmtInt(r.channel_total)}</Text>
        </View>
        <View style={st.sumCol}>
          <Text style={st.sumLabel}>{t('currentBalance')}</Text>
          <Text style={st.sumVal}>{fmtInt(r.real_total)}</Text>
        </View>
        <View style={st.sumCol}>
          <Text style={st.sumLabel}>{t('bookDiff')}</Text>
          <Text style={[st.sumVal, { color: Math.abs(r.diff) < 0.005 ? '#059669' : '#DC2626' }]}>
            {r.diff >= 0 ? '+' : ''}{fmtInt(Math.abs(r.diff))}
          </Text>
        </View>
      </View>
      {/* Divider */}
      <View style={st.divider} />
      {/* Row 3: card + cash + funds in transit */}
      <View style={st.detailRow}>
        <View style={st.detailCol}>
          <Text style={st.detailLabel}>{t('cardBalance')}</Text>
          <Text style={st.detailVal}>{fmtAmt(r.card_balance)}</Text>
        </View>
        <View style={st.detailCol}>
          <Text style={st.detailLabel}>{t('cashBalance')}</Text>
          <Text style={st.detailVal}>{fmtAmt(r.cash_balance)}</Text>
        </View>
        <View style={st.detailCol}>
          <Text style={st.detailLabel}>{t('fundsInTransit')}</Text>
          <Text style={st.detailVal}>{fmtAmt(r.channel_total)}</Text>
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
            <Text style={st.modalDate}>{fmtDate(r.date)}</Text>
            <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.6}>
              <Text style={st.modalClose}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
          {/* Three vertical pair groups */}
          <View style={st.pairRow}>
            {/* Group 1: 卡余额 / 账面余额 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('cardBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.card_balance)}</Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('bookBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.channel_total)}</Text>
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
        <View style={{ width: 44 }} />
      </View>
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dateIcon: { fontSize: 14 },
  dateText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  summaryRow: { flexDirection: 'row' },
  sumCol: { flex: 1, alignItems: 'center', gap: 2 },
  sumLabel: { fontSize: 10, color: '#999', fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  detailRow: { flexDirection: 'row' },
  detailCol: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 10, color: '#999', fontWeight: '500' },
  detailVal: { fontSize: 13, fontWeight: '600', color: '#374151' },
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
  },
  modalHeader: {
    backgroundColor: '#8B1E22',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 18,
  },
  modalDate: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
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
});
