import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { modalClose, historyHeader } from '../sharedStyles';
import DateErrorHint from '../components/DateErrorHint';
import BackArrow from '../components/icons/BackArrow';

const PAGE_SIZE = 10;

const todayStr = () => new Date().toISOString().split('T')[0];
const defaultFromDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};
const isFuture = (d: string) => d > todayStr();
// Strict calendar months between two ISO dates (YYYY-MM-DD)
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return m;
}

function RevenueEmptyIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M7 15l4-4 2 2 4-5" />
      <circle cx="17" cy="8" r="1.2" fill={color} stroke="none" />
    </Svg>
  );
}

export default function DailyRevenueHistory({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const loadingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Uncontrolled date refs
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [dateFrom, setDateFrom] = useState(defaultFromDate());
  const [dateTo, setDateTo] = useState(todayStr());
  useEffect(() => { if (dateFromRef.current) dateFromRef.current.value = dateFrom; }, [dateFrom]);
  useEffect(() => { if (dateToRef.current) dateToRef.current.value = dateTo; }, [dateTo]);
  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
  const [appliedTo, setAppliedTo] = useState(dateTo);
  const [filterDateError, setFilterDateError] = useState(0);
  const [dateFromKey, setDateFromKey] = useState(0);
  const [dateToKey, setDateToKey] = useState(0);

  const { colors } = useTheme();

  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);

  const rangeInvalid = useMemo(() =>
    !!(dateFrom && dateTo && dateFrom > dateTo),
    [dateFrom, dateTo]);
  // 24-month max-span guard (strict calendar months)
  const rangeTooLong = useMemo(() =>
    !!(dateFrom && dateTo && !rangeInvalid && monthsBetween(dateFrom, dateTo) > 24),
    [dateFrom, dateTo, rangeInvalid]);

  // Server-side paginated load
  const loadPage = useCallback(async (pg: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) setLoading(true);
    try {
      const r: any = await api.getDailyRevenue(
        pg, PAGE_SIZE,
        undefined, undefined, undefined, undefined,
        appliedFrom || undefined,
        appliedTo || undefined,
      );
      const recs = r?.records || [];
      setRecords(prev => reset ? recs : [...prev, ...recs]);
      setPage(pg);
      setTotal(r?.total || 0);
      setTotalAll(r?.total_all ?? r?.total ?? 0);
      setHasMore(pg < (r?.pages || 1));
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
    loadingRef.current = false;
  }, [appliedFrom, appliedTo]);

  // Reload when filter changes
  const filterKey = `${appliedFrom}|${appliedTo}`;
  useEffect(() => {
    setRecords([]);
    loadPage(1, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
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

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    const l = getLang();
    if (l.startsWith('en')) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[+m-1]} ${+day}, ${y}`;
    }
    return `${y}/${m}/${day}`;
  };

  const toDec2 = (x: any) => String(parseFloat(x || 0).toFixed(2));

  const st = useMemo(() => getSt(colors), [colors]);

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrow color={colors.primary} />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('revHistoryBtn')} ({total}/{totalAll})</Text>
        <TouchableOpacity
          style={[st.filterBtn, showFilter && st.filterBtnActive]}
          onPress={() => {
            if (!showFilter) {
              filterAnim.setValue(0);
              Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 170, friction: 26 }).start();
            }
            setShowFilter(!showFilter);
          }}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
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
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('revenueDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {dateFrom ? (
                    <Text style={st.filterDateText}>{fmtDate(dateFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" ref={dateFromRef} defaultValue={dateFrom} max={todayStr()} key={dateFromKey}
                    onChange={(e: any) => { if (isFuture(e.target.value)) { dateFromRef.current!.value = dateFrom; setDateFromKey(k => k + 1); setFilterDateError(c => c + 1); } else { setDateFrom(e.target.value); } }}
                    style={st.filterDateHidden as any} />
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
                <View style={st.filterDateWrap}>
                  {dateTo ? (
                    <Text style={st.filterDateText}>{fmtDate(dateTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" ref={dateToRef} defaultValue={dateTo} max={todayStr()} key={dateToKey}
                    onChange={(e: any) => { if (isFuture(e.target.value)) { dateToRef.current!.value = dateTo; setDateToKey(k => k + 1); setFilterDateError(c => c + 1); } else { setDateTo(e.target.value); } }}
                    style={st.filterDateHidden as any} />
                </View>
              </View>
            </View>
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={() => {
                const dFrom = defaultFromDate();
                const dTo = todayStr();
                setDateFrom(dFrom);
                setDateTo(dTo);
                setAppliedFrom(dFrom);
                setAppliedTo(dTo);
              }} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
                disabled={rangeInvalid || rangeTooLong}
                onPress={() => {
                  setAppliedFrom(dateFrom);
                  setAppliedTo(dateTo);
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
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={50}
        contentContainerStyle={{ paddingTop: showFilter ? 166 : 112, paddingHorizontal: 16, paddingBottom: 80 }}>
        {loading ? (
          <View style={st.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.loadingText}>{t('loading')}</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}><RevenueEmptyIcon color={colors.textSub} /></View>
            <Text style={st.emptyTitle}>{t('revEmpty')}</Text>
            <Text style={st.emptyHint}>{t('revEmptyHint')}</Text>
          </View>
        ) : (
          <>
            {records.map((rec: any, i: number) => (
              <View key={i} style={st.card}>
                <View style={st.cardTop}>
                  <Text style={st.cardDate}>{fmtDate(rec.date)}</Text>
                  <View style={[st.statusBadge, (rec.status === '未录入' || !rec.recorded_by) ? st.statusBadgeEmpty : st.statusBadgeDone]}>
                    <View style={[st.statusDot, (rec.status === '未录入' || !rec.recorded_by) ? st.statusDotEmpty : st.statusDotDone]} />
                    <Text style={[st.statusText, (rec.status === '未录入' || !rec.recorded_by) ? st.statusTextEmpty : st.statusTextDone]}>
                      {rec.status === '未录入' || !rec.recorded_by ? t('revNotEntered') : t('revEntered')}
                    </Text>
                  </View>
                </View>

                {rec.archived ? (
                  <View style={st.archivedBadge}>
                    <Text style={st.archivedBadgeText}>{t('revMarkArchive')}</Text>
                  </View>
                ) : null}

                <View style={st.cardAmounts}>
                  <View style={st.cardAmtCol}>
                    <Text style={[st.cardAmtVal, { color: rec.revenue > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.revenue)}</Text>
                    <Text style={st.cardAmtLabel}>{t('revRevenue')}</Text>
                  </View>
                  <View style={st.cardAmtCol}>
                    <Text style={[st.cardAmtVal, { color: rec.turnover > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.turnover)}</Text>
                    <Text style={st.cardAmtLabel}>{t('revTurnover')}</Text>
                  </View>
                  <View style={st.cardAmtCol}>
                    <Text style={[st.cardAmtVal, { color: rec.jd_revenue > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.jd_revenue)}</Text>
                    <Text style={st.cardAmtLabel}>{t('revJD')}</Text>
                  </View>
                </View>

                <View style={st.cardFooter}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={st.cardFooterText}>{t('recordedBy')}:</Text>
                    {rec.recorded_by ? (
                      <Text style={st.cardFooterText}>{rec.recorded_by}</Text>
                    ) : (
                      <Svg width={16} height={8} viewBox="0 0 16 8" fill="none" stroke={colors.secondary} strokeWidth={1.5} strokeLinecap="round">
                        <Path d="M2 4h12" />
                      </Svg>
                    )}
                  </View>
                </View>
                {rec.note ? (
                  <View style={st.cardNote}>
                    <Text style={st.cardNoteText}>{rec.note}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {hasMore && (
              <View style={st.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={st.loadingMoreText}>{t('loading')}...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getSt = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  ...historyHeader(colors),

  filterPanel: {
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.secondary, overflow: 'hidden',
  },
  filterContent: { padding: 12, gap: 8 },
  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub, width: 64, flexShrink: 0 },
  filterDateRange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  filterApplyBtnDisabled: { backgroundColor: colors.secondary },
  filterApplyBtnText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  filterApplyBtnTextDisabled: { color: colors.textSub },

  list: { flex: 1 },

  card: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: colors.secondary,
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    gap: 12,
  } as any,
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5,
  },
  statusBadgeEmpty: { backgroundColor: withAlpha(colors.danger, 0.1) },
  statusBadgeDone: { backgroundColor: withAlpha(colors.success, 0.1) },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotEmpty: { backgroundColor: colors.danger },
  statusDotDone: { backgroundColor: colors.success },
  statusText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight },
  statusTextEmpty: { color: colors.danger },
  statusTextDone: { color: colors.success },

  cardAmounts: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: colors.surface, borderRadius: 8,
  },
  cardAmtCol: { alignItems: 'center', flex: 1, gap: 4 },
  cardAmtVal: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight },
  cardAmtLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },

  cardFooter: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8 },
  cardFooterText: { fontSize: FONTS.micro.size, color: colors.textSub },

  archivedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  archivedBadgeText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.danger },

  cardNote: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8, marginTop: 4 },
  cardNoteText: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 16 },

  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(colors.textSub, 0.06), justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textSub },
  emptyHint: { fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 40, gap: 8 },
  loadingText: { fontSize: FONTS.sub.size, color: colors.primary },
  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
});
