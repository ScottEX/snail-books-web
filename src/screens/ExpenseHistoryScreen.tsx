import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { t } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

const PAGE_SIZE = 10;

export default function ExpenseHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const scrollRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (p: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const tx: any = await api.getTransactions(p);
      const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
      setRecords(prev => p === 1 ? exps : [...prev, ...exps]);
      setHasMore(p < (tx.pages || 1));
      setPage(p);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
    loadingRef.current = false;
  }, []);

  // First load
  useEffect(() => { loadPage(1); }, []);

  // Scroll-to-bottom pagination — native DOM listener
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60 && hasMore && !loadingRef.current) {
        loadPage(page + 1);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasMore, page]);

  return (
    <View style={st.overlay}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* List */}
      <View style={st.listWrap} ref={scrollRef as any}>
        {records.length === 0 && !loading ? (
          <Text style={st.empty}>{t('noData')}</Text>
        ) : (
          <>
            {records.map((e: any, i: number) => (
              <View key={i} style={st.row}>
                <View style={st.meta}>
                  <View style={st.badges}>
                    <View style={st.catBadge}>
                      <Text style={st.catBadgeText}>{e.category || t('daily')}</Text>
                    </View>
                    <View style={st.payBadge}>
                      <Text style={st.payBadgeText}>{e.account || t('payWechat')}</Text>
                    </View>
                    <Text style={st.dateText}>{e.date || (e.created_at || '').slice(0, 10)}</Text>
                  </View>
                  <Text style={st.amount}>-¥{e.amount.toLocaleString()}</Text>
                </View>
                {e.note ? (
                  <Text style={st.note}>{e.note}</Text>
                ) : null}
              </View>
            ))}
            {loading && (
              <Text style={st.loading}>...</Text>
            )}
          </>
        )}
      </View>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 150, backgroundColor: '#FAFAFA',
  },
  /* Header — glass */
  header: {
    paddingTop: 14, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.30)',
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.08)',
    zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(250,250,250,0.30)',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
  },
  backArrow: { fontSize: 26, fontWeight: '300', color: '#8B1E22', marginTop: -2, marginLeft: -1 },
  title: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  /* List */
  listWrap: {
    flex: 1, paddingHorizontal: 18, paddingTop: 12,
    // @ts-ignore
    overflowY: 'auto' as any,
  },
  row: {
    paddingVertical: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  meta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  badges: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
  },
  catBadge: {
    backgroundColor: '#FFF0EB', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  catBadgeText: { fontSize: 11, fontWeight: '600', color: '#FA855A' },
  payBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  payBadgeText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
  dateText: { fontSize: 10, color: '#9CA3AF' },
  amount: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  note: { fontSize: 12, color: '#6B7280', paddingLeft: 2 },
  empty: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  loading: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
});
