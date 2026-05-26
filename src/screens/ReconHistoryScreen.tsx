import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { t, getLang } from '../i18n';
import { api } from '../api/client';

export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getReconciliations();
        setRecords(data || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const fmtDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const l = getLang();
    if (l.startsWith('en')) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const fmtAmt = (n: number) => '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Text style={st.backText}>‹ {t('back')}</Text>
        </TouchableOpacity>
        <Text style={st.title}>{t('reconHistory')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* List */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={st.loading}>{t('loading') || 'Loading...'}</Text>
        ) : records.length === 0 ? (
          <Text style={st.empty}>{t('noRecords') || 'No records yet'}</Text>
        ) : (
          records.map((r: any) => (
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
                <Text style={st.chLabel}>{t('fundsInTransit')}：</Text>
                <Text style={st.chVal}>{fmtAmt(r.channel_total)}</Text>
              </View>
              <View style={st.cRow}>
                {[
                  ['🍜', r.dine_in],
                  ['🛵', r.meituan],
                  ['⚡', r.flash_sale],
                  ['📦', r.jd],
                  ['🎫', r.tuan],
                ].map(([icon, amt], i) => (
                  <Text key={i} style={st.chip}>{icon} {amt?.toFixed(0)}</Text>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: '#8B1E22', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  list: { flex: 1, paddingHorizontal: 16 },
  loading: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#999' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#999' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#EBEBEB',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  date: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  diff: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  item: { flex: 1 },
  label: { fontSize: 11, color: '#999', fontWeight: '500', marginBottom: 2 },
  val: { fontSize: 14, fontWeight: '600', color: '#374151' },
  channels: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  chVal: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
