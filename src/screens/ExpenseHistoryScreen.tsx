import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { t } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

const PAGE_SIZE = 10;

export default function ExpenseHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const scrollRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(false);
  const apiPageRef = useRef(1);
  const doneRef = useRef(false);

  const fetchUntil = useCallback(async (minNeeded: number) => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      let all = [...records];
      while (all.length < minNeeded && !doneRef.current) {
        const tx: any = await api.getTransactions(apiPageRef.current);
        const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
        all = [...all, ...exps];
        if (apiPageRef.current >= (tx.pages || 1)) {
          doneRef.current = true;
          break;
        }
        apiPageRef.current++;
      }
      setRecords(all);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
    loadingRef.current = false;
  }, [records]);

  useEffect(() => { fetchUntil(PAGE_SIZE); }, []);

  // Scroll pagination on the overlay itself
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loadingRef.current) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        const next = displayCount + PAGE_SIZE;
        if (next <= records.length) {
          setDisplayCount(next);
        } else if (!doneRef.current) {
          fetchUntil(next);
          setDisplayCount(records.length + PAGE_SIZE);
        }
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [displayCount, records.length, fetchUntil]);

  const visible = records.slice(0, Math.min(displayCount, records.length));
  const hasMore = displayCount < records.length || !doneRef.current;

  return (
    <View style={st.overlay} ref={scrollRef as any}>
      {/* Spacer so content starts below the absolute header */}
      <View style={{ height: 72 }} />

      {visible.length === 0 && !loading ? (
        <Text style={st.empty}>{t('noData')}</Text>
      ) : (
        <>
          {visible.map((e: any, i: number) => (
            <View key={i} style={st.row}>
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
          {loading && <Text style={st.loading}>...</Text>}
          {hasMore && !loading && <View style={{ height: 40 }} />}
          {/* Bottom spacer for nav bar */}
          <View style={{ height: 80 }} />
        </>
      )}

      {/* Header — absolute, floats above scrolling overlay. Truly transparent. */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

const st = StyleSheet.create({
  /* Overlay — the scroll container itself */
  overlay: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    // @ts-ignore
    overflowY: 'auto' as any,
  },
  /* Header — absolute on top, floating above scrolled content */
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
  /* Row */
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
