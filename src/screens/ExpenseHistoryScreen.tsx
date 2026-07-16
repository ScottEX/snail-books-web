import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator, Animated, Image, Platform
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { trCategory, trPayment, catKey } from '../i18nHelpers';
import { api } from '../api/client';
import { useServerDate } from '../hooks/useServerDate';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useToast } from '../hooks/useToast';
import EmptyState from "../components/EmptyState";
import LoadingSpinner from '../components/LoadingSpinner';
import ImagePreview from '../components/ImagePreview';
import { useImagePreview } from '../hooks/useImagePreview';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { FONTS } from '../theme';
import { modalClose, historyHeader } from '../sharedStyles';
import { getCurrentUser } from '../utils/storage';
import DateErrorHint from '../components/DateErrorHint';
import BackArrow from '../components/icons/BackArrow';
import FilterPanel from '../components/FilterPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
// Stamp seal — expense (linked to procurement). Mirrors invoice 已作废 / procurement stamp.
function IcnSealExp({ color, label }: { color: string; label: string }) {
  return (
    <Svg width={42} height={42} viewBox="0 0 42 42">
      <Circle cx={21} cy={21} r={19.5} fill="none" stroke={color} strokeWidth={1.3} />
      <Circle cx={21} cy={21} r={17} fill="none" stroke={color} strokeWidth={0.5} strokeDasharray="2.5 1.8" />
      <text x={21} y={24} textAnchor="middle" fontSize={8} fontWeight="700" fill={color} transform="rotate(-12, 21, 21)">{label}</text>
    </Svg>
  );
}

export default function ExpenseHistoryScreen({ onBack, refreshKey, onExpDetail, onInvoice }: { onBack: () => void; refreshKey?: number; onExpDetail?: (e: any) => void; onInvoice?: (batchId: number) => void }) {
  const swipeBack = useSwipeBack(onBack);
  const { showToast, ToastHost } = useToast();
  const { preview: previewData, openPreview, closePreview } = useImagePreview();

  // Uncontrolled date refs — React Native Web <input type="date"> crashes with controlled value={state}
  const filDateFromRef = useRef<HTMLInputElement>(null);
  const filDateToRef = useRef<HTMLInputElement>(null);
  const sd = useServerDate();

  const [showFilter, setShowFilter] = useState(false);
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
    onError: () => showToast(t('toastLoadFailed')),
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
    return (
      <TouchableOpacity onPress={() => onExpDetail?.(e)} activeOpacity={0.7}>
        <View style={st.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
        <View style={st.rowTop}>
          <View style={st.badges}>
            <View style={st.catBadge}>
              <Text style={st.catBadgeText}>{trCat(e.category || '')}</Text>
            </View>
            <View style={st.payBadge}>
              <Text style={st.payBadgeText}>{trPay(e.account || '')}</Text>
            </View>
            {e.procurement_batch_id ? (
              e.invoice_status ? (
              <TouchableOpacity
                onPress={() => onInvoice?.(e.procurement_batch_id)}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: e.invoice_status === 'done' ? withAlpha(colors.success, 0.12) : withAlpha(colors.warning, 0.12) }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: e.invoice_status === 'done' ? colors.success : colors.warning }}>
                  {e.invoice_status === 'done' ? t('invRecStatusDone') : t('invRecStatusPending')}
                </Text>
              </TouchableOpacity>
              ) : (
              <TouchableOpacity
                onPress={() => onInvoice?.(e.procurement_batch_id)}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: withAlpha(colors.primary, 0.10) }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>
                  {t('invToInvoice')}
                </Text>
              </TouchableOpacity>
              )
            ) : null}
          </View>
          {/* Wrap amount + seal so the seal anchors to the amount text, not the row. */}
          <View style={st.expAmountWrap}>
            <Text style={[st.amount,  (Number(e.amount) < 0) && { color: colors.success }]}>{(Number(e.amount) < 0) ? '+' : '-'}¥{Math.abs(Number(e.amount || 0)).toFixed(2)}</Text>
            {e.proc_batch_number ? (
              <View style={st.expSealWrap} pointerEvents="none">
                <IcnSealExp
                  color={e.proc_settled_at ? colors.success : colors.warning}
                  label={e.proc_settled_at ? t('procSettled') : t('procUnsettled')}
                />
              </View>
            ) : null}
          </View>
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
                onPress={() => openPreview(previewImgs, j)}
                activeOpacity={0.8}>
                {Platform.OS === 'web' ? (
                  React.createElement('img', {
                    src: url,
                    loading: 'lazy' as any,
                    decoding: 'async' as any,
                    style: {
                      width: 48, height: 48, borderRadius: 6, objectFit: 'cover',
                      backgroundColor: colors.bg,
                    } as any,
                    alt: 'receipt',
                  })
                ) : (
                  <Image source={{ uri: url }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: colors.bg }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        </View>
      </View>
      </TouchableOpacity>
    );
  }, [currentUser, colors.bg, colors.success, colors.warning, st, parseImages, trCat, trPay, fmtExpDate, t, onExpDetail]);

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
            <BackArrow color="#000" />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('expenseHistory')} ({total}/{totalAll})</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => setShowFilter(!showFilter)} activeOpacity={0.7}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : '#000'} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      <FilterPanel visible={showFilter} onClose={() => setShowFilter(false)} top={50}>
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
                <Text style={{ color: colors.textSub, marginHorizontal: 2 }}>→</Text>
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
            {/* Quick date buttons */}
            <View style={st.filterField}>
              <Text style={st.filterLabel}>　</Text>
              <View style={st.filterChipRow}>
                {[
                  { label: t('quickToday'), date: sd.today },
                  { label: t('quickYesterday'), date: sd.offset(-1) },
                  { label: t('quickDBY'), date: sd.offset(-2) },
                  { label: t('quick3DAgo'), date: sd.offset(-3) },
                ].map(q => {
                  const active = filDateFrom === q.date && filDateTo === q.date;
                  return (
                    <TouchableOpacity key={q.label}
                      style={[st.filterChip, active && st.filterChipActive]}
                      onPress={() => { setFilDateFrom(q.date); setFilDateTo(q.date); }} activeOpacity={0.7}>
                      <Text style={[st.filterChipText, active && st.filterChipTextActive]}>{q.label}</Text>
                    </TouchableOpacity>
                  );
                })}
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
      </FilterPanel>

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
        contentContainerStyle={{ paddingTop: showFilter ? 240 : 4, paddingHorizontal: 16, paddingBottom: 20 }}
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
        <View style={{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingTop: 50 }}>
          <LoadingSpinner label={false} />
        </View>
      )}

      {previewData && (
        <ImagePreview
          images={previewData.images}
          initialIdx={previewData.idx}
          visible={true}
          onClose={closePreview}
        />
      )}

      {ToastHost}
    </View>
  );
}

const getSt = (colors: ThemeColors): any => {
  const hdr = historyHeader(colors);
  return StyleSheet.create({
  /* Root — flex: 1, no background (page bg from parent) */
  root: { flex: 1 },
  ...hdr as any,
  header: { ...hdr.header, top: 0, paddingTop: 7, paddingBottom: 7, height: 50 },
  /* List — scrolls under absolute header (matches ReconHistoryScreen list) */
  list: { flex: 1, marginTop: 50 },
  /* Row */
  row: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore

    gap: 6,
  },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    position: 'relative' as const,
    minHeight: 44,
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
  filledBy: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
  imgThumbs: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  dateText: { fontSize: FONTS.sub.size, color: colors.textSub, flexShrink: 0 },
  note: { fontSize: FONTS.sub.size, color: colors.textSub, flex: 1, textAlign: 'right', overflow: 'hidden' },
  expAmountWrap: {
    position: 'relative' as const,
  } as any,
  expSealWrap: {
    width: 42, height: 42, alignItems: 'center' as const, justifyContent: 'center' as const,
    position: 'absolute' as const,
    right: 0, top: '50%', marginTop: -36,
    opacity: 0.75,
  } as any,

  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
  /* Preview overlay */

  /* Filter panel — matches ReconHistoryScreen */
  filterBtnTextActive: { color: colors.surface },
  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
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
  filterDateText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.primary },
  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: withAlpha(colors.primary, 0.5) },
  filterDateHidden: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.01,  width: '100%', height: '100%',
  },
  filterChipRow: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.bg,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
  filterChipTextActive: { color: colors.surface },
  filterActions: { flexDirection: 'row', gap: 8, paddingTop: 6 },
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
};