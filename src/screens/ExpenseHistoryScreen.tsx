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
      {/* Header — absolute, floats above scroll content (matches 对账记录 style) */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* List — scrolls underneath the absolute header */}
      <View style={st.listWrap} ref={scrollRef as any}>
        {records.length === 0 && !loading ? (
          <Text style={st.empty}>{t('noData')}</Text>
        ) : (
          <>
            {records.map((e: any, i: number) => (
              <View key={i} style={st.row}>
                {/* Row 1: badges + amount */}
                <View style={st.rowTop}>
                  <View style={st.badges}>
                    <View style={st.catBadge}>
                      <Text style={st.catBadgeText}>{e.category || t('daily')}</Text>
                    </View>
                    <View style={st.payBadge}>
                      <Text style={st.payBadgeText}>{e.account || t('payWechat')}</Text>
                    </View>
                  </View>
                  <Text style={st.amount}>-¥{e.amount.toLocaleString()}</Text>
                </View>
                {/* Row 2: date + note */}
                <View style={st.rowBottom}>
                  <Text style={st.dateText}>{e.date || (e.created_at || '').slice(0, 10)}</Text>
                  {e.note ? (
                    <Text style={st.note} numberOfLines={1}>{e.note}</Text>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                </View>
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
  /* Header — absolute positioning, matches 对账记录 */
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'transparent',
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
  title: { fontSize: 16, fontWeight: '400', color: '#1A1A1A' },
  /* List — padded to clear absolute header (14 + 14 + 44) */
  listWrap: {
    flex: 1, paddingTop: 72, paddingHorizontal: 16,
    // @ts-ignore
    overflowY: 'auto' as any,
  },
  /* Row: two-line layout, all 5 fields clearly visible */
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  badges: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1,
  },
  catBadge: {
    backgroundColor: '#FFF0EB', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  catBadgeText: { fontSize: 13, fontWeight: '600', color: '#FA855A' },
  payBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  payBadgeText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  amount: { fontSize: 17, fontWeight: '700', color: '#DC2626' },
  rowBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText: { fontSize: 13, color: '#9CA3AF' },
  note: { fontSize: 13, color: '#6B7280', flex: 1, textAlign: 'right' },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  loading: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
});
