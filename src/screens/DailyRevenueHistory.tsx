import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { t } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

interface Props {
  onBack: () => void;
}

export default function DailyRevenueHistory({ onBack }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return fmtDate(d);
  });
  const [dateTo, setDateTo] = useState(() => fmtDate(new Date()));
  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
  const [appliedTo, setAppliedTo] = useState(dateTo);

  const todayStr = fmtDate(new Date());

  const loadRecords = async (from: string, to: string) => {
    setLoading(true);
    try {
      const r = await api.getDailyRevenue(1, 200);
      // Filter client side by date range
      const filtered = (r.records || []).filter((rec: any) => rec.date >= from && rec.date <= to);
      setRecords(filtered);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
  };

  useEffect(() => {
    loadRecords(appliedFrom, appliedTo);
  }, []);

  const applyFilter = () => {
    if (dateFrom > dateTo) { setToast(t('errDateRange')); return; }
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    loadRecords(dateFrom, dateTo);
  };

  const toDec2 = (x: any) => String(parseFloat(x || 0).toFixed(2));

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingHorizontal: 20 }}>
          <TouchableOpacity onPress={onBack} style={{ paddingVertical: 8, paddingRight: 12 }}>
            <Text style={{ fontSize: 16, color: '#8B1E22' }}>← {t('back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A' }}>📋 {t('dailyRevenue')}</Text>
          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Filter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ position: 'relative', flex: 1 }}>
          <TouchableOpacity activeOpacity={1} style={st.dateBox}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{dateFrom}</Text>
            {React.createElement('input', {
              type: 'date', value: dateFrom, max: todayStr,
              onChange: (e: any) => { const v = e.target.value; if (v <= todayStr) setDateFrom(v); },
              style: { position: 'absolute', inset: 0, opacity: 0.01, cursor: 'pointer' },
            })}
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: '#9CA3AF' }}>至</Text>
        <View style={{ position: 'relative', flex: 1 }}>
          <TouchableOpacity activeOpacity={1} style={st.dateBox}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{dateTo}</Text>
            {React.createElement('input', {
              type: 'date', value: dateTo, max: todayStr,
              onChange: (e: any) => { const v = e.target.value; if (v <= todayStr) setDateTo(v); },
              style: { position: 'absolute', inset: 0, opacity: 0.01, cursor: 'pointer' },
            })}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={applyFilter} activeOpacity={0.7}
          style={{ backgroundColor: '#FA855A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>{t('apply')}</Text>
        </TouchableOpacity>
      </View>

      {/* Table */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {/* Table header */}
          <View style={st.tableRow}>
            <Text style={[st.th, { flex: 2.2 }]}>{t('date')}</Text>
            <Text style={[st.th, { flex: 2 }]}>{t('revRevenue')}</Text>
            <Text style={[st.th, { flex: 1.8 }]}>{t('revTurnover')}</Text>
            <Text style={[st.th, { flex: 2 }]}>{t('revJD')}</Text>
            <Text style={[st.th, { flex: 1.4 }]}>{t('status')}</Text>
            <Text style={[st.th, { flex: 1.6 }]}>{t('recordedBy')}</Text>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13 }}>...</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#9CA3AF', marginTop: 8 }}>{t('revEmpty')}</Text>
            </View>
          ) : (
            records.map((rec: any, i: number) => (
              <View key={i} style={[st.tableRow, { backgroundColor: i % 2 === 0 ? '#FAFAFA' : '#FFF' }]}>
                <Text style={[st.td, { flex: 2.2, fontWeight: '600' }]}>{rec.date}</Text>
                <Text style={[st.td, { flex: 2 }]}>{rec.revenue > 0 ? `¥${toDec2(rec.revenue)}` : '—'}</Text>
                <Text style={[st.td, { flex: 1.8 }]}>{rec.turnover > 0 ? `¥${toDec2(rec.turnover)}` : '—'}</Text>
                <Text style={[st.td, { flex: 2 }]}>{rec.jd_revenue > 0 ? `¥${toDec2(rec.jd_revenue)}` : '—'}</Text>
                <Text style={[st.td, { flex: 1.4, color: rec.status === '未录入' || !rec.recorded_by ? '#9CA3AF' : '#059669' }]}>
                  {rec.status === '未录入' ? t('revNotEntered') : t('revEntered')}
                </Text>
                <Text style={[st.td, { flex: 1.6 }]}>{rec.recorded_by || '—'}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0EB' },
  header: {
    backgroundColor: 'rgba(250,250,250,0.55)',
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
    zIndex: 50,
  },
  dateBox: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0',
  },
  th: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  td: { fontSize: 11, fontWeight: '500', color: '#374151' },
});
