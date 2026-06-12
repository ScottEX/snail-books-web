import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Animated
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { trCategory, trPayment, catKey } from '../i18nHelpers';
import { api } from '../api/client';
import { useServerDate } from '../hooks/useServerDate';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Toast from "../components/Toast";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from '../components/LoadingSpinner';
import ImagePreview from '../components/ImagePreview';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { FONTS } from '../theme';
import { modalClose, historyHeader } from '../sharedStyles';
import { getCurrentUser } from '../utils/storage';
import DateErrorHint from '../components/DateErrorHint';
import BackArrow from '../components/icons/BackArrow';

// Date helpers replaced by useServerDate() hook
// Strict calendar months between two ISO dates (YYYY-MM-DD)
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return m;
}

function ExpenseEmptyIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Circle cx="10" cy="12" r="3" />
      <Path d="M8 12h4" />
      <Path d="M9 17h6" />
      <Path d="M9 20h4" />
    </Svg>
  );
}

export default function ExpenseHistoryScreen({ onBack, refreshKey, onExpDetail }: { onBack: () => void; refreshKey?: number; onExpDetail?: (e: any) => void }) {
  const swipeBack = useSwipeBack(onBack);
  const [toast, setToast] = useState('');
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);

  // Uncontrolled date refs — React Native Web <input type="date"> crashes with controlled value={state}
  const filDateFromRef = useRef<HTMLInputElement>(null);
  const filDateToRef = useRef<HTMLInputElement>(null);
  const sd = useServerDate();

  const [showFilter, setShowFilter] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [filDateFrom, setFilDateFrom] = useState(sd.offset(-30));
  const [filDateTo, setFilDateTo] = useState(sd.today);
  useEffect(() => { if (filDateFromRef.current) filDateFromRef.current.value = filDateFrom; }, [filDateFrom]);
  useEffect(() => { if (filDateToRef.current) filDateToRef.current.value = filDateTo; }, [filDateTo]);
  const [filCategories, setFilCategories] = useState<string[]>([]);
  // Track active filters (snapshot at last apply) — compare strings to avoid object deps
  const [appliedFrom, setAppliedFrom] = useState(sd.offset(-30));
  const [appliedTo, setAppliedTo] = useState(sd.today);
  const [appliedCats, setAppliedCats] = useState('');

  const [filterDateError, setFilterDateError] = useState(0);
  const [filDateFromKey, setFilDateFromKey] = useState(0);
  const [filDateToKey, setFilDateToKey] = useState(0);

  // Once server date arrives, backfill the date filter defaults
  useEffect(() => {
    if (sd.ready && !appliedFrom) {
      const from = sd.offset(-30);
      const to = sd.today;
      setFilDateFrom(from);
      setFilDateTo(to);
      setAppliedFrom(from);
      setAppliedTo(to);
    }
  }, [sd.ready, appliedFrom, appliedTo, sd.today, sd.offset]);

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

  // Paginated list hook (must be after getFilterParams)
  const { records, page, total, totalAll, hasMore, loading, loadPage, onEndReached } = usePaginatedList({
    fetchPage: useCallback(async (pg: number, perPage: number) => {
      const tx: any = await api.getTransactions(pg, perPage, getFilterParams());
      return { items: tx.transactions || [], total: tx.total || 0, totalAll: tx.total_all, pages: tx.pages || 1 };
    }, [getFilterParams]),
    onError: () => setToast(t('toastLoadFailed')),
  });

  // i18n mapping for category & payment.
  const trCat = (s: string) => trCategory(s);
  const trPay = (s: string) => trPayment(s);
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

  const isFuture = (d: string) => d > sd.today;
  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);

  // Initial load — trigger when filter params change (wait for server date)
  const filterKey = `${appliedFrom}|${appliedTo}|${appliedCats}`;
  useEffect(() => {
    if (!sd.ready && appliedFrom === '' && appliedTo === '') return;
    loadPage(1, true);
  }, [filterKey, refreshKey, sd.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current user for displaying who filled each record
  const currentUser = getCurrentUser();

  // Render a single transaction row (FlatList item) — uses thumb_images for the
  // 48×48 list tile (fast, ~5-10KB) and falls back to full-size images for old
  // data without thumb_images. Preview always opens the full-size images.
  const renderItem = useCallback(({ item: e, index: i }: { item: any; index: number }) => {
    const thumbImgs = e.thumb_images ? parseImages(e.thumb_images) : [];
    const displayImgs = thumbImgs.length > 0 ? thumbImgs : parseImages(e.images);
    const previewImgs = parseImages(e.images);
    const isRefund = Number(e.amount || 0) < 0;
    return (
      <View style={{ position: 'relative' }}>
        <TouchableOpacity onPress={() => onExpDetail?.(e)} activeOpacity={0.7}>
          <View style={st.row}>
        <View style={st.rowTop}>
          <View style={st.badges}>
            <View style={st.catBadge}>
              <Text style={st.catBadgeText}>{trCat(e.category || '')}</Text>
            </View>
            <View style={st.payBadge}>
              <Text style={st.payBadgeText}>{trPay(e.account || '')}</Text>
            </View>
          </View>
          <Text style={[st.amount, isRefund && { color: colors.success }]}>{isRefund ? '+' : '-'}¥{Math.abs(Number(e.amount || 0)).toFixed(2)}</Text>
        </View>
        {currentUser ? (
          <Text style={st.filledBy}>{t('filledBy')}: {currentUser}</Text>
        ) : null}
        <View style={st.rowBottom}>
          <Text style={st.dateText}>{fmtExpDate(e.date || (e.created_at || '').slice(0, 10))}</Text>
          {e.proc_batch_number ? (
            <Text style={st.note} numberOfLines={1}>{t('procNowBatch').replace('{n}', String(e.proc_batch_number))}</Text>
          ) : e.note ? (
            <Text style={st.note} numberOfLines={1}>{e.note}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
        {/* Image thumbnails — lazy + async + bg placeholder so JS thread stays free for scroll */}
        {displayImgs.length > 0 && (
          <View style={st.imgThumbs}>
            {displayImgs.map((url: string, j: number) => (
              <TouchableOpacity key={j}
                onPress={() => setPreviewData({ images: previewImgs, idx: j })}
                activeOpacity={0.8}>
                {React.createElement('img', {
                  src: url,
                  loading: 'lazy' as any,
                  decoding: 'async' as any,
                  style: {
                    width: 48, height: 48, borderRadius: 6, objectFit: 'cover',
                    backgroundColor: colors.bg,
                  } as any,
                  alt: 'receipt',
                })}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      </TouchableOpacity>
        {/* Refund stamp — outside TouchableOpacity to avoid clipping */}
        {isRefund && (
          <View style={st.refundStamp}>
            <Text style={st.refundStampText}>{t('refund')}</Text>
          </View>
        )}
      </View>
    );
  }, [currentUser, colors.bg, st, parseImages, trCat, trPay, fmtExpDate, t, onExpDetail]);

  // Category toggle
  const toggleCat = (cat: string) => {
    setFilCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // No client-side filtering — server handles it
  const visible = records;

  // Date range validity — persistent hint while invalid (matches ReconHistoryScreen)
  const rangeInvalid = useMemo(() =>
    !!(filDateFrom && filDateTo && filDateFrom > filDateTo),
    [filDateFrom, filDateTo]);
  // 24-month max-span guard (strict calendar months)
  const rangeTooLong = useMemo(() =>
    !!(filDateFrom && filDateTo && !rangeInvalid && monthsBetween(filDateFrom, filDateTo) > 24),
    [filDateFrom, filDateTo, rangeInvalid]);



  return (
    <View style={st.root} {...swipeBack}>
      {/* Header — absolute, transparent, floats above scroll (matches ReconHistoryScreen) */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrow color={colors.primary} />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')} ({total}/{totalAll})</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => {
            if (!showFilter) {
              filterAnim.setValue(0);
              Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 170, friction: 26 }).start();
            }
            setShowFilter(!showFilter);
          }} activeOpacity={0.7}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilter && (<>
        <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, opacity: filterAnim }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => {
            Animated.timing(filterAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShowFilter(false));
          }} />
        </Animated.View>
        <Animated.View style={{
          position: 'fixed' as any, top: 108, left: 12, right: 12, zIndex: 9999,
          opacity: filterAnim,
          transform: [
            { translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            { scale: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        }}>
        <View style={st.filterPanel}>
          <View style={st.filterContent}>
            <DateErrorHint trigger={filterDateError} message={t('errDateFuture')} color={colors.danger} />
            {rangeInvalid && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRange')}</Text>}
            {rangeTooLong && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRangeTooLong')}</Text>}
            {/* Date range */}
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('expenseDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {filDateFrom ? (
                    <Text style={st.filterDateText}>{fmtExpDate(filDateFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" ref={filDateFromRef} defaultValue={filDateFrom} max={sd.today} key={filDateFromKey}
                    onChange={(e: any) => { if (sd.isFuture(e.target.value)) { filDateFromRef.current!.value = filDateFrom; setFilDateFromKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateFrom(e.target.value); } }}
                    style={st.filterDateHidden as any} />
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
                <View style={st.filterDateWrap}>
                  {filDateTo ? (
                    <Text style={st.filterDateText}>{fmtExpDate(filDateTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" ref={filDateToRef} defaultValue={filDateTo} max={sd.today} key={filDateToKey}
                    onChange={(e: any) => { if (sd.isFuture(e.target.value)) { filDateToRef.current!.value = filDateTo; setFilDateToKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateTo(e.target.value); } }}
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
                const dFrom = sd.offset(-30);
                const dTo = sd.today;
                setFilDateFrom(dFrom);
                setFilDateTo(dTo);
                setFilCategories([]);
                setAppliedFrom(dFrom);
                setAppliedTo(dTo);
                setAppliedCats('');
              }} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
                disabled={rangeInvalid || rangeTooLong}
                onPress={() => {
                  setAppliedFrom(filDateFrom);
                  setAppliedTo(filDateTo);
                  setAppliedCats(filCategories.map(catKey).join(','));
                  setShowFilter(false);
                }} activeOpacity={0.8}>
                <Text style={[st.filterApplyBtnText, (rangeInvalid || rangeTooLong) && st.filterApplyBtnTextDisabled]}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
                </Animated.View>
      </>)}

      {/* List */}
      <FlatList
        testID="exp-scroll"
        style={st.list}
        data={visible}
        keyExtractor={(e: any, i: number) => e.id != null ? `tx-${e.id}` : `tx-${i}`}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: showFilter ? 246 : 112, paddingHorizontal: 16, paddingBottom: 100 }}
        ListEmptyComponent={!loading ? (
          <EmptyState
            icon={<ExpenseEmptyIcon color={colors.textSub} />}
            title={t('noRecords')}
            hint={t('emptyExpenseHint')}
          />
        ) : null}
        ListFooterComponent={hasMore ? (
          <View style={st.loadingMore}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={st.loadingMoreText}>{t('loading')}...</Text>
          </View>
        ) : null}
      />

      {/* Loading overlay — covers empty state during initial load */}
      {loading && records.length === 0 && (
        <View style={{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingTop: 112 }}>
          <LoadingSpinner label={false} />
        </View>
      )}

      {previewData && (
        <ImagePreview
          images={previewData.images}
          initialIdx={previewData.idx}
          visible={true}
          onClose={() => setPreviewData(null)}
        />
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
  catBadgeText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary },
  payBadge: {
    backgroundColor: colors.bg, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  payBadgeText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
  amount: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.danger },
  /* Refund stamp */
  refundStamp: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    transform: [{ rotate: '-12deg' }],
    opacity: 0.85,
  } as any,
  refundStampText: {
    fontSize: 13, fontWeight: '700', color: colors.danger,
  },
  filledBy: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
  imgThumbs: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  dateText: { fontSize: FONTS.sub.size, color: colors.textSub, flexShrink: 0 },
  note: { fontSize: FONTS.sub.size, color: colors.textSub, flex: 1, textAlign: 'right', overflow: 'hidden' },

  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
  /* Preview overlay */

  /* Filter panel — matches ReconHistoryScreen */
  filterBtnTextActive: { color: colors.surface },
  filterPanel: {
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.secondary,
    overflow: 'hidden',
  },
  filterContent: { padding: 12, gap: 8 },
  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub, width: 64, flexShrink: 0 },
  filterDateRange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // @ts-ignore outline is web-only CSS, not in RN types
  filterDateInput: {
    flex: 1, height: 34, paddingHorizontal: 8,
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
    fontFamily: 'inherit', outline: 'none',
  },
  filterDateWrap: {
    flex: 1, height: 34, position: 'relative' as any,
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    justifyContent: 'center', paddingHorizontal: 8,
  },
  filterDateText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
  filterDateHidden: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
  },
  filterChipRow: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.bg,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
  filterChipTextActive: { color: colors.surface },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterResetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.secondary, borderRadius: 8,
  },
  filterResetBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
  filterApplyBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.primary, borderRadius: 8,
  },
  filterApplyBtnDisabled: {
    backgroundColor: colors.secondary,
  },
  filterApplyBtnText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  filterApplyBtnTextDisabled: {
    color: colors.textSub,
  },
} as any);