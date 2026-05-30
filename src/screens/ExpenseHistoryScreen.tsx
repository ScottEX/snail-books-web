import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import { FilterBackdrop } from '../components/FilterBackdrop';
import Toast from '../components/Toast';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { modalCardAnimation, modalClose, historyHeader } from '../sharedStyles';

const PAGE_SIZE = 10;

export default function ExpenseHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
  const [previewOpacity, setPreviewOpacity] = useState(1);
  const touchStartX = useRef(0);
  const [showFilter, setShowFilter] = useState(false);
  const [filDateFrom, setFilDateFrom] = useState('');
  const [filDateTo, setFilDateTo] = useState('');
  const [filCategories, setFilCategories] = useState<string[]>([]);
  // Track active filters (snapshot at last apply) — compare strings to avoid object deps
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedCats, setAppliedCats] = useState('');
  const loadingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { colors } = useTheme();
  const st = useMemo(() => getSt(colors), [colors]);

  // Build filter params from applied values
  const getFilterParams = useCallback((): Record<string, string> => {
    const f: Record<string, string> = { type: 'expense' };
    if (appliedFrom) f.date_from = appliedFrom;
    if (appliedTo) f.date_to = appliedTo;
    if (appliedCats) f.category = appliedCats;
    return f;
  }, [appliedFrom, appliedTo, appliedCats]);

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
    const [y, m, day] = d.split('-');
    const l = getLang();
    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
    return `${y}年${m}月${day}日`;
  };

  // Parse images field from API (stored as JSON string '["url1","url2"]')
  const parseImages = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  };

  // Fetch one page from server (with current filters)
  const loadPage = useCallback(async (pg: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const tx: any = await api.getTransactions(pg, PAGE_SIZE, getFilterParams());
      const exps = tx.transactions || [];
      setRecords(prev => reset ? exps : [...prev, ...exps]);
      setPage(pg);
      setTotal(tx.total || 0);
      setHasMore(pg < (tx.pages || 1));
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
    loadingRef.current = false;
  }, [getFilterParams]);

  // Initial load — trigger when filter params change
  const filterKey = `${appliedFrom}|${appliedTo}|${appliedCats}`;
  useEffect(() => {
    setRecords([]);
    loadPage(1, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current user for displaying who filled each record
  const currentUser = (() => { try { return localStorage.getItem('user') || ''; } catch { return ''; } })();

  // Scroll pagination — load next page when near bottom
  const handleScroll = useCallback((e: any) => {
    if (loadingRef.current || !hasMore) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 60) {
      if (!scrollTimerRef.current) {
        scrollTimerRef.current = setTimeout(() => {
          scrollTimerRef.current = null;
          loadPage(page + 1, false);
        }, 150);
      }
    }
  }, [page, hasMore, loadPage]);

  // Category toggle
  const toggleCat = (cat: string) => {
    setFilCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // No client-side filtering — server handles it
  const visible = records;

  const navPreview = (newIdx: number) => {
    setPreviewOpacity(0);
    setTimeout(() => {
      setPreviewData({ images: previewData!.images, idx: newIdx });
      setPreviewOpacity(1);
    }, 150);
  };

  const validateExpDates = (): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const from = filDateFrom, to = filDateTo;
    if ((from && from > today) || (to && to > today)) { setToast(t('errDateFuture')); return false; }
    if (from && to && from > to) { setToast(t('errDateRange')); return false; }
    return true;
  };

  return (
    <View style={st.root}>
      {/* Header — absolute, transparent, floats above scroll (matches ReconHistoryScreen) */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')} ({total})</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => setShowFilter(!showFilter)} activeOpacity={0.7}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilter && (
        <>
          <FilterBackdrop onPress={() => setShowFilter(false)} />
          <View style={st.filterPanel}>
          <View style={st.filterContent}>
            {/* Date range */}
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('filterDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {filDateFrom ? (
                    <Text style={st.filterDateText}>{fmtExpDate(filDateFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filDateFrom} onChange={(e: any) => setFilDateFrom(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
                <Text style={st.filterDateArrow}>→</Text>
                <View style={st.filterDateWrap}>
                  {filDateTo ? (
                    <Text style={st.filterDateText}>{fmtExpDate(filDateTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filDateTo} onChange={(e: any) => setFilDateTo(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
              </View>
            </View>
            {/* Category chips */}
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('filterCategory')}</Text>
              <View style={st.filterChipRow}>
                {(['日常', '房租', '薪资', '采购'] as const).map(cat => {
                  const active = filCategories.includes(cat);
                  return (
                    <TouchableOpacity key={cat}
                      style={[st.filterChip, active && st.filterChipActive]}
                      onPress={() => toggleCat(cat)} activeOpacity={0.7}>
                      <Text style={[st.filterChipText, active && st.filterChipTextActive]}>{t(cat === '日常' ? 'daily' : cat === '房租' ? 'rent' : cat === '薪资' ? 'salary' : 'goods' as any)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* Actions */}
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={() => {
                setFilDateFrom(''); setFilDateTo(''); setFilCategories([]);
                setAppliedFrom(''); setAppliedTo(''); setAppliedCats('');
              }} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.filterApplyBtn} onPress={() => {
                if (validateExpDates()) {
                  // Snapshot filter values so server query runs with new params
                  setAppliedFrom(filDateFrom);
                  setAppliedTo(filDateTo);
                  setAppliedCats(filCategories.join(','));
                  setShowFilter(false);
                }
              }} activeOpacity={0.8}>
                <Text style={st.filterApplyBtnText}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </>
      )}

      {/* List — ScrollView with content padding (matches ReconHistoryScreen) */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={50}
        contentContainerStyle={{ paddingTop: showFilter ? 210 : 76, paddingHorizontal: 16, paddingBottom: 80 }}>
        {visible.length === 0 && !loading ? (
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}><Text style={st.emptyEmoji}>{'\uD83D\uDCCB'}</Text></View>
            <Text style={st.emptyTitle}>{t('noRecords')}</Text>
            <Text style={st.emptyHint}>{t('emptyExpenseHint')}</Text>
          </View>
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
                  <Text style={st.amount}>-¥{e.amount.toFixed(2)}</Text>
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
            {loading && (
              <View style={st.loading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={st.loadingText}>...</Text>
              </View>
            )}
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
                navPreview(previewData.idx + 1);
              } else if (dx > 0 && previewData.idx > 0) {
                navPreview(previewData.idx - 1);
              }
            }
          }}>
          <TouchableOpacity style={st.previewClose}
            onPress={() => setPreviewData(null)}
            activeOpacity={0.7}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.surface} strokeWidth={2} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
          {previewData.images.length > 1 && previewData.idx > 0 && (
            <TouchableOpacity style={st.previewArrowLeft}
              onPress={() => navPreview(previewData.idx - 1)}
              activeOpacity={0.7}>
              <Text style={st.previewArrowText}>{'\u2039'}</Text>
            </TouchableOpacity>
          )}
          {previewData.images.length > 1 && previewData.idx < previewData.images.length - 1 && (
            <TouchableOpacity style={st.previewArrowRight}
              onPress={() => navPreview(previewData.idx + 1)}
              activeOpacity={0.7}>
              <Text style={st.previewArrowText}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
          {React.createElement('img', {
            src: previewData.images[previewData.idx],
            key: previewData.idx,
            style: {
              maxWidth: '90%', maxHeight: '80%', borderRadius: 12, objectFit: 'contain',
              opacity: previewOpacity,
              // @ts-ignore
              transition: 'opacity 0.2s ease',
            },
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

const getSt = (colors: ThemeColors): any => StyleSheet.create({
  /* Root — flex: 1, no background (page bg from parent) */
  root: { flex: 1 },
  ...historyHeader(colors),
  /* List — scrolls under absolute header (matches ReconHistoryScreen list) */
  list: { flex: 1 },
  /* Row */
  row: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: colors.secondary,
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
    backgroundColor: withAlpha(colors.warning, 0.1), borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  catBadgeText: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.primary },
  payBadge: {
    backgroundColor: colors.bg, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  payBadgeText: { fontSize: FONTS.sub.size, fontWeight: '500', color: colors.textSub },
  amount: { fontSize: FONTS.h2.size, fontWeight: '700', color: colors.danger },
  filledBy: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
  imgThumbs: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText: { fontSize: FONTS.sub.size, color: colors.textSub },
  note: { fontSize: FONTS.sub.size, color: colors.textSub, flex: 1, textAlign: 'right' },
  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.secondary },
  emptyEmoji: { fontSize: FONTS.h1.size },
  emptyTitle: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textSub },
  emptyHint: { fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingText: { fontSize: FONTS.sub.size, color: colors.primary },
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
  previewArrowText: { fontSize: FONTS.amount.size, fontWeight: '300', color: colors.surface, marginTop: -2 },
  previewCounter: {
    position: 'absolute', bottom: 60, zIndex: 10,
    fontSize: FONTS.sub.size, fontWeight: '500', color: 'rgba(255,255,255,0.7)',
  },
  /* Filter panel — matches ReconHistoryScreen */
  filterBtnTextActive: { color: colors.surface },
  filterPanel: {
    position: 'absolute', top: 72, left: 12, right: 12, zIndex: 89,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.secondary,
    overflow: 'hidden',
    ...modalCardAnimation,
  },
  filterContent: { padding: 12, gap: 8 },
  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textSub, width: 64, flexShrink: 0 },
  filterDateRange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // @ts-ignore outline is web-only CSS, not in RN types
  filterDateInput: {
    flex: 1, height: 34, paddingHorizontal: 8,
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: '400', color: colors.textSub,
    fontFamily: 'inherit', outline: 'none',
  },
  filterDateWrap: {
    flex: 1, height: 34, position: 'relative' as any,
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    justifyContent: 'center', paddingHorizontal: 8,
  },
  filterDateText: { fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textSub },
  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: '400', color: colors.textSub },
  filterDateHidden: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
  },
  filterDateArrow: { fontSize: 14, color: colors.secondary, fontWeight: '300', marginHorizontal: 2 },
  filterChipRow: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.bg,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: FONTS.micro.size, fontWeight: '600', color: colors.textSub },
  filterChipTextActive: { color: colors.surface },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterResetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.secondary, borderRadius: 8,
  },
  filterResetBtnText: { fontSize: FONTS.sub.size, fontWeight: '500', color: colors.textSub },
  filterApplyBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.primary, borderRadius: 8,
  },
  filterApplyBtnText: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.surface },
} as any);