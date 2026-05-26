import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { t, getLang } from '../i18n';
import { api } from '../api/client';

const PAGE_SIZE = 10;

export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const touchRef = useRef({ startX: 0, startY: 0 });
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getReconciliations();
        setRecords(data || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const visible = records.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < records.length;

  /* Infinite scroll */
  const handleScroll = useCallback((e: any) => {
    if (!hasMore) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
    if (!nearBottom) return;
    if (scrollTimerRef.current) return;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      setPage(p => p + 1);
    }, 300);
  }, [hasMore]);

  const fmtDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const l = getLang();
    if (l.startsWith('en')) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const fmtAmt = (n: number) => '\u00A5' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  /* Swipe-to-back */
  const onTouchStart = (e: any) => {
    const t = e.nativeEvent?.touches?.[0] || e.nativeEvent;
    touchRef.current = { startX: t.pageX, startY: t.pageY };
  };
  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent?.changedTouches?.[0] || e.nativeEvent;
    const dx = t.pageX - touchRef.current.startX;
    const dy = Math.abs(t.pageY - touchRef.current.startY);
    if (touchRef.current.startX < 36 && dx > 80 && dx > dy * 1.5) {
      onBack();
    }
  };

  const renderCard = (r: any) => (
    <View key={r.id} style={st.card}>
      <View style={st.cardHeader}>
        <Text style={st.date}>{fmtDate(r.date)}</Text>
        <Text style={[st.diff, { color: Math.abs(r.diff) < 0.005 ? '#059669' : '#DC2626' }]}>
          {r.diff >= 0 ? '+' : ''}{fmtAmt(r.diff)}
        </Text>
      </View>
      <View style={st.row}>
        <View style={st.item}>
          <Text style={st.label}>{t('cardBalance')}</Text>
          <Text style={st.val}>{fmtAmt(r.card_balance)}</Text>
        </View>
        <View style={st.item}>
          <Text style={st.label}>{t('cashBalance')}</Text>
          <Text style={st.val}>{fmtAmt(r.cash_balance)}</Text>
        </View>
      </View>
      <View style={st.channels}>
        <Text style={st.chLabel}>{t('fundsInTransit')}\uFF1A</Text>
        <Text style={st.chVal}>{fmtAmt(r.channel_total)}</Text>
      </View>
      <View style={st.cRow}>
        {[
          ['\uD83C\uDF5C', r.dine_in],
          ['\uD83D\uDEF5', r.meituan],
          ['\u26A1', r.flash_sale],
          ['\uD83D\uDCE6', r.jd],
          ['\uD83C\uDFAB', r.tuan],
        ].map(([icon, amt], i) => (
          <Text key={i} style={st.chip}>{icon} {amt?.toFixed(0)}</Text>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={st.emptyWrap}>
      <View style={st.emptyIcon}>
        <Text style={st.emptyEmoji}>{'\uD83D\uDCCB'}</Text>
      </View>
      <Text style={st.emptyTitle}>{t('noRecords')}</Text>
      <Text style={st.emptyHint}>{t('emptyReconHint')}</Text>
    </View>
  );

  return (
    <View style={st.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TouchableOpacity style={st.backFloat} onPress={onBack} activeOpacity={0.7}>
        <Text style={st.backFloatArrow}>{'\u2039'}</Text>
      </TouchableOpacity>
      <View style={st.header}>
        <View style={{ width: 44 }} />
        <Text style={st.title}>{t('reconHistory')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={200}>
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
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  backFloat: {
    position: 'absolute', top: 14, left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(250,250,250,0.72)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
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
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#EBEBEB',
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  date: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  diff: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  item: { flex: 1 },
  label: { fontSize: 10, color: '#999', fontWeight: '500', marginBottom: 2 },
  val: { fontSize: 13, fontWeight: '600', color: '#374151' },
  channels: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  chLabel: { fontSize: 10, color: '#999', fontWeight: '500' },
  chVal: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: 10, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FAF7F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EBEBEB' },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#6B7280' },
  emptyHint: { fontSize: 13, color: '#B0B0B0', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
