import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

const PAGE_SIZE = 10;

export default function ExpenseHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
  const touchStartX = useRef(0);
  const loadingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiPageRef = useRef(1);
  const doneRef = useRef(false);
  const totalRef = useRef(0);

  // i18n mapping for category & payment from API raw strings
  const trCat = (s: string) => {
    if (s.includes('日常')) return t('daily');
    if (s.includes('房租')) return t('rent');
    if (s.includes('薪资')) return t('salary');
    if (s.includes('采购')) return t('goods');
    return s;
  };
  const trPay = (s: string) => {
    if (s.includes('微信')) return t('payWechat');
    if (s.includes('支付宝') || s.includes('Alipay')) return t('payAlipay');
    if (s.includes('现金')) return t('payCash');
    return s;
  };
  const fmtExpDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const l = getLang();
    if (l.startsWith('en')) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // Parse images field from API (stored as JSON string '["url1","url2"]')
  const parseImages = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  };

  const fetchUntil = useCallback(async (minNeeded: number) => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      let all = [...records];
      while (all.length < minNeeded && !doneRef.current) {
        const tx: any = await api.getTransactions(apiPageRef.current);
        if (apiPageRef.current === 1) totalRef.current = 0;
        const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
        totalRef.current += exps.length;
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

  // Current user for displaying who filled each record
  const currentUser = (() => { try { return localStorage.getItem('user') || ''; } catch { return ''; } })();

  // Scroll pagination — matches ReconHistoryScreen pattern
  const handleScroll = useCallback((e: any) => {
    if (loadingRef.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 120) {
      if (!scrollTimerRef.current) {
        scrollTimerRef.current = setTimeout(() => {
          scrollTimerRef.current = null;
          const next = displayCount + PAGE_SIZE;
          if (next > records.length && !doneRef.current) {
            fetchUntil(next);
          }
          setDisplayCount(next);
        }, 300);
      }
    }
  }, [displayCount, records.length, fetchUntil]);

  const visible = records.slice(0, Math.min(displayCount, records.length));

  return (
    <View style={st.root}>
      {/* Header — absolute, transparent, floats above scroll (matches ReconHistoryScreen) */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')} ({totalRef.current})</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* List — ScrollView with content padding (matches ReconHistoryScreen) */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={200}
        contentContainerStyle={{ paddingTop: 76, paddingHorizontal: 16, paddingBottom: 80 }}>
        {visible.length === 0 && !loading ? (
          <Text style={st.empty}>{t('noData')}</Text>
        ) : (
          <>
            {visible.map((e: any, i: number) => (
              <View key={i} style={st.row}>
                <View style={st.rowTop}>
                  <View style={st.badges}>
                    <View style={st.catBadge}>
                      <Text style={st.catBadgeText}>{trCat(e.category || '')}</Text>
                    </View>
                    <View style={st.payBadge}>
                      <Text style={st.payBadgeText}>{trPay(e.account || '')}</Text>
                    </View>
                  </View>
                  <Text style={st.amount}>-¥{e.amount.toLocaleString()}</Text>
                </View>
                {currentUser ? (
                  <Text style={st.filledBy}>{t('filledBy')}: {currentUser}</Text>
                ) : null}
                <View style={st.rowBottom}>
                  <Text style={st.dateText}>{fmtExpDate(e.date || (e.created_at || '').slice(0, 10))}</Text>
                  {e.note ? (
                    <Text style={st.note} numberOfLines={1}>{e.note}</Text>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                </View>
                {/* Image thumbnails */}
                {(() => {
                  const imgs = parseImages(e.images);
                  if (imgs.length === 0) return null;
                  return (
                    <View style={st.imgThumbs}>
                      {imgs.map((url: string, j: number) => (
                        <TouchableOpacity key={j}
                          onPress={() => setPreviewData({ images: imgs, idx: j })}
                          activeOpacity={0.8}>
                          {React.createElement('img', {
                            src: url,
                            style: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover' },
                            alt: 'receipt',
                          })}
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}
              </View>
            ))}
            {loading && <Text style={st.loading}>...</Text>}
          </>
        )}
      </ScrollView>

      {/* Fullscreen image preview with left/right swipe */}
      {previewData && (
        <View style={st.previewOverlay}
          onTouchStart={(e: any) => { touchStartX.current = e.nativeEvent.pageX || e.nativeEvent.touches?.[0]?.pageX || 0; }}
          onTouchEnd={(e: any) => {
            const endX = e.nativeEvent.pageX || e.nativeEvent.changedTouches?.[0]?.pageX || 0;
            const dx = endX - touchStartX.current;
            if (Math.abs(dx) > 60) {
              if (dx < 0 && previewData.idx < previewData.images.length - 1) {
                setPreviewData({ images: previewData.images, idx: previewData.idx + 1 });
              } else if (dx > 0 && previewData.idx > 0) {
                setPreviewData({ images: previewData.images, idx: previewData.idx - 1 });
              }
            }
          }}>
          <TouchableOpacity style={st.previewClose}
            onPress={() => setPreviewData(null)}
            activeOpacity={0.7}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
          {previewData.images.length > 1 && previewData.idx > 0 && (
            <TouchableOpacity style={st.previewArrowLeft}
              onPress={() => setPreviewData({ images: previewData.images, idx: previewData.idx - 1 })}
              activeOpacity={0.7}>
              <Text style={st.previewArrowText}>{'\u2039'}</Text>
            </TouchableOpacity>
          )}
          {previewData.images.length > 1 && previewData.idx < previewData.images.length - 1 && (
            <TouchableOpacity style={st.previewArrowRight}
              onPress={() => setPreviewData({ images: previewData.images, idx: previewData.idx + 1 })}
              activeOpacity={0.7}>
              <Text style={st.previewArrowText}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
          {React.createElement('img', {
            src: previewData.images[previewData.idx],
            style: { maxWidth: '90%', maxHeight: '80%', borderRadius: 12, objectFit: 'contain' },
            alt: 'preview',
          })}
          {previewData.images.length > 1 && (
            <Text style={st.previewCounter}>{previewData.idx + 1} / {previewData.images.length}</Text>
          )}
        </View>
      )}

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

const st = StyleSheet.create({
  /* Root — flex: 1, no background (page bg from parent) */
  root: { flex: 1 },
  /* Header — frosted glass, floats above scroll */
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(250,250,250,0.55)',
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
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
  /* List — scrolls under absolute header (matches ReconHistoryScreen list) */
  list: { flex: 1 },
  /* Row */
  row: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: '#EBEBEB',
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
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
  filledBy: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  imgThumbs: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText: { fontSize: 13, color: '#9CA3AF' },
  note: { fontSize: 13, color: '#6B7280', flex: 1, textAlign: 'right' },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  loading: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  /* Preview overlay */
  previewOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewArrowLeft: {
    position: 'absolute', left: 16, top: '50%', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, marginTop: -20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewArrowRight: {
    position: 'absolute', right: 16, top: '50%', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, marginTop: -20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewArrowText: { fontSize: 28, fontWeight: '300', color: '#FFFFFF', marginTop: -2 },
  previewCounter: {
    position: 'absolute', bottom: 60, zIndex: 10,
    fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)',
  },
});
