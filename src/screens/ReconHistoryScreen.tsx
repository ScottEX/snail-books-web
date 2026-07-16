import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Dimensions, Animated } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { useSwipeBack } from '../hooks/useSwipeBack';
import ModalOverlay from '../components/ModalOverlay';
import { api } from '../api/client';
import { useServerDate } from '../hooks/useServerDate';
import { usePaginatedList } from '../hooks/usePaginatedList';
import DatePicker from '../components/DatePicker';
import { useToast } from '../hooks/useToast';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { modalClose, historyHeader, MODAL_CARD_RADIUS } from '../sharedStyles';
import { fmtAmtFull } from '../utils/format';
import DateErrorHint from '../components/DateErrorHint';
import BackArrow from '../components/icons/BackArrow';
import FilterPanel from '../components/FilterPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Date format
// Strict calendar months between two ISO dates (YYYY-MM-DD)
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return m;
}

function ReconEmptyIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<any>(null);
  const selectedRef = useRef<any>(null);
  const { showToast, ToastHost } = useToast();
  const swipeBack = useSwipeBack(onBack);
  // Uncontrolled date refs — React Native Web <input type="date"> crashes with controlled value={state}
  const filDateFromRef = useRef<HTMLInputElement>(null);
  const filDateToRef = useRef<HTMLInputElement>(null);

  const { colors } = useTheme();
  const sd = useServerDate();
  const st = useMemo(() => getSt(colors), [colors]);

  const [showFilter, setShowFilter] = useState(false);
  const [filDateFrom, setFilDateFrom] = useState(sd.offset(-30));
  const [filDateTo, setFilDateTo] = useState(sd.today);
  useEffect(() => { if (filDateFromRef.current) filDateFromRef.current.value = filDateFrom; }, [filDateFrom]);
  useEffect(() => { if (filDateToRef.current) filDateToRef.current.value = filDateTo; }, [filDateTo]);
  const [filBy, setFilBy] = useState('');
  const [users, setUsers] = useState<{id: number; username: string}[]>([]);
  const [showUserPick, setShowUserPick] = useState(false);
  const userDropAnim = useRef(new Animated.Value(0)).current;
  const dropScale = useRef(new Animated.Value(0.85)).current;
  const dropSlide = useRef(new Animated.Value(12)).current;
  const userBtnRef = useRef<any>(null);
  const [dropPos, setDropPos] = useState({ x: 0, y: 0, w: 160 });

  const openUserDrop = () => {
    if (showUserPick) { closeUserDrop(); return; }
    // Measure button position for dropdown alignment
    if (userBtnRef.current) {
      const el = userBtnRef.current;
      if (typeof el.getBoundingClientRect === 'function') {
        const r = el.getBoundingClientRect();
        setDropPos({ x: r.left - 8, y: r.bottom + 4, w: 160 });
      } else if (el.measure) {
        el.measure((_x: number, _y: number, _w: number, _h: number, px: number, py: number) => {
          setDropPos({ x: px, y: py + 34 + 4, w: _w });
        });
      }
    }
    setShowUserPick(true);
    dropScale.setValue(0.85);
    dropSlide.setValue(12);
    userDropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(dropScale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 14 }),
      Animated.spring(dropSlide, { toValue: 0, useNativeDriver: true, bounciness: 8, speed: 14 }),
      Animated.timing(userDropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeUserDrop = () => {
    Animated.parallel([
      Animated.timing(dropScale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(dropSlide, { toValue: 12, duration: 180, useNativeDriver: true }),
      Animated.timing(userDropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowUserPick(false));
  };
  // Track applied filters (snapshot at last apply)
  const [appliedFrom, setAppliedFrom] = useState(sd.offset(-30));
  const [appliedTo, setAppliedTo] = useState(sd.today);
  const [appliedBy, setAppliedBy] = useState('');
  const [filterDateError, setFilterDateError] = useState(0);

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

  // Reset error when filter panel opens
  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);

  // Date range validity — persistent hint while invalid
  const rangeInvalid = useMemo(() =>
    (!!filDateFrom && !!filDateTo && filDateFrom > filDateTo),
    [filDateFrom, filDateTo]);
  // 24-month max-span guard (strict calendar months)
  const rangeTooLong = useMemo(() =>
    (!!filDateFrom && !!filDateTo && !rangeInvalid && monthsBetween(filDateFrom, filDateTo) > 24),
    [filDateFrom, filDateTo, rangeInvalid]);

  // Fetch users when filter panel opens
  useEffect(() => {
    if (showFilter && users.length === 0) {
      api.getUsers().then(data => setUsers(data || [])).catch(() => {});
    }
  }, [showFilter]);

  // Build filter params from applied values
  const getFilterParams = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {};
    if (appliedFrom) f.date_from = appliedFrom;
    if (appliedTo) f.date_to = appliedTo;
    if (appliedBy) f.reconciled_by = appliedBy;
    return f;
  }, [appliedFrom, appliedTo, appliedBy]);

  // Paginated list hook
  const { records, total, totalAll, hasMore, loading, loadPage, handleScroll } = usePaginatedList({
    fetchPage: useCallback(async (pg: number, perPage: number) => {
      const data: any = await api.getReconciliationsPage(pg, perPage, getFilterParams());
      return { items: data?.records || [], total: data?.total || 0, totalAll: data?.total_all, pages: data?.pages || 1 };
    }, [getFilterParams]),
    onError: () => showToast(t('toastLoadFailed')),
  });

  const resetFilters = () => {
    const dFrom = sd.offset(-30);
    const dTo = sd.today;
    setFilDateFrom(dFrom);
    setFilDateTo(dTo);
    setFilBy('');
    setAppliedFrom(dFrom);
    setAppliedTo(dTo);
    setAppliedBy('');
  };

  // Trigger load when filter params change
  const filterKey = `${appliedFrom}|${appliedTo}|${appliedBy}`;
  useEffect(() => {
    loadPage(1, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    const l = getLang();
    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
    return `${y}年${+m}月${+day}日`;
  };

  const fmtDateTime = (d: string) => {
    // d is "YYYY-MM-DD HH:MM:SS" from created_at — split date and time
    const [datePart, timePart] = d.split(' ');
    const [y, m, day] = datePart.split('-');
    const l = getLang();
    if (l.startsWith('en')) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return timePart ? `${months[+m-1]} ${+day}, ${y} ${timePart}` : `${months[+m-1]} ${+day}, ${y}`;
    }
    return timePart ? `${y}年${+m}月${+day}日 ${timePart}` : `${y}年${+m}月${+day}日`;
  };



  // Card: compact summary (tap to open detail modal)
  const renderCard = (r: any) => (
    <TouchableOpacity key={r.id} style={st.card} onPress={() => { selectedRef.current = r; setSelected(r); }} activeOpacity={0.7}>
      {/* Row 1: two dates */}
      <View style={st.dateRow}>
        <View style={st.dateItem}>
          <Text style={st.dateLabel}>{t('reconDate')}</Text>
          <Text style={st.dateVal}>{fmtDateTime(r.created_at || r.date)}</Text>
        </View>
        <View style={st.dateSep} />
        <View style={st.dateItem}>
          <Text style={st.dateLabel}>{t('billDate')}</Text>
          <Text style={st.dateVal}>{fmtDate(r.bill_date || r.date)}</Text>
        </View>
      </View>
      {/* Reconciler */}
      {r.reconciled_by ? (
        <View style={st.reconByRow}>
          <Text style={st.reconByText}>{t('reconciledBy')}: {r.reconciled_by}</Text>
        </View>
      ) : null}
      {/* Row 2: 3 vertical pair columns */}
      <View style={st.cardPairRow}>
        {/* Col 1: 账面余额 / 卡余额 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('bookBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmtFull(r.cash_on_hand)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cardBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmtFull(r.card_balance)}</Text>
          </View>
        </View>
        {/* Col 2: 当前结余 / 现金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('currentBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmtFull(r.real_total)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cashBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmtFull(r.cash_balance)}</Text>
          </View>
        </View>
        {/* Col 3: 账面差额 / 在途资金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('bookDiff')}</Text>
            <Text style={[st.cardPairVal, { color: r.diff > 0.005 ? colors.success : r.diff < -0.005 ? colors.danger : colors.textMain }]}>
              {r.diff >= 0 ? '+' : '-'}{fmtAmtFull(Math.abs(r.diff))}
            </Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('fundsInTransit')}</Text>
            <Text style={[st.cardPairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmtFull(r.channel_total)}</Text>
          </View>
        </View>
      </View>
      {/* Tap hint */}
      <Text style={st.tapHint}>{t('tapForDetail')}</Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <EmptyState
      icon={<ReconEmptyIcon color={colors.textSub} />}
      title={t('noRecords')}
      hint={t('emptyReconHint')}
    />
  );

  const todayISO = sd.today;

  return (
    <View style={st.root} {...swipeBack}>
      {/* Toast */}
      {ToastHost}
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrow color="#000" />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('reconHistory')} ({total}/{totalAll})</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => setShowFilter(!showFilter)} activeOpacity={0.7}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : '#000'} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>
      {/* Filter bar */}
      <FilterPanel visible={showFilter} onClose={() => { setShowFilter(false); closeUserDrop(); }} top={50}>
            <DateErrorHint trigger={filterDateError} message={t('errDateFuture')} color={colors.danger} />
            {rangeInvalid && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRange')}</Text>}
            {rangeTooLong && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRangeTooLong')}</Text>}
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  <DatePicker
                    date={filDateFrom}
                    onChange={setFilDateFrom}
                    max={todayISO}
                    onFutureDate={() => setFilterDateError(c => c + 1)}
                    displayDate={filDateFrom ? fmtDate(filDateFrom) : t('any')}
                    fontSize={FONTS.micro.size}
                    showChevron={false}
                  />
                </View>
                <Text style={{ color: colors.textSub, marginHorizontal: 2 }}>→</Text>
                <View style={st.filterDateWrap}>
                  <DatePicker
                    date={filDateTo}
                    onChange={setFilDateTo}
                    max={todayISO}
                    onFutureDate={() => setFilterDateError(c => c + 1)}
                    displayDate={filDateTo ? fmtDate(filDateTo) : t('any')}
                    fontSize={FONTS.micro.size}
                    showChevron={false}
                  />
                </View>
              </View>
            </View>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconciledBy')}</Text>
              <View style={st.filterSelectWrap}>
                <TouchableOpacity
                  ref={userBtnRef}
                  style={{ flex: 1, height: '100%', justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }}
                  onPress={openUserDrop} activeOpacity={0.7}
                >
                  <Text style={st.filterSelectText}>{filBy || t('any')}</Text>
                  <Svg width={12} height={12} viewBox="0 0 1024 1024" style={{ marginLeft: 4, transform: [{ rotate: showUserPick ? '180deg' : '0deg' }] }}>
                    <Path d="M836.899 399.237l-218.01 335.037c-47.506 73.007-166.272 73.007-213.778 0l-218.01-335.037C139.595 326.23 198.977 234.97 293.99 234.97h436.02c95.013 0 154.395 91.26 106.889 164.267z" fill={colors.textMain} />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
                disabled={rangeInvalid || rangeTooLong}
                onPress={() => {
                  setAppliedFrom(filDateFrom);
                  setAppliedTo(filDateTo);
                  setAppliedBy(filBy);
                  setShowFilter(false);
              }} activeOpacity={0.8}>
                <Text style={[st.filterApplyBtnText, (rangeInvalid || rangeTooLong) && st.filterApplyBtnTextDisabled]}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
      </FilterPanel>

      {/* User dropdown — outside FilterPanel, positioned dynamically */}
      {showUserPick && (
        <Animated.View style={{
          position: 'fixed' as any, top: dropPos.y, left: dropPos.x, width: dropPos.w, zIndex: 10000,
          opacity: userDropAnim,
          transform: [{ translateY: dropSlide }, { scale: dropScale }],
          transformOrigin: 'top left' as any,
        }}>
        <View style={{
          backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.secondary,
          overflow: 'hidden' as any,
        }}>
          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => { setFilBy(''); closeUserDrop(); }} activeOpacity={0.6} style={{ paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 4, marginTop: 4, borderRadius: 8, backgroundColor: filBy === '' ? withAlpha(colors.primary, 0.15) : 'transparent' }}>
            <Text style={{ fontSize: FONTS.sub.size, color: filBy === '' ? colors.primary : colors.textMain, fontWeight: filBy === '' ? '700' : FONTS.sub.weight }}>{t('any')}</Text>
          </TouchableOpacity>
          {users.map((u, i) => (
            <TouchableOpacity key={u.id} onPress={() => { setFilBy(u.username); closeUserDrop(); }} activeOpacity={0.6} style={{ paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 4, marginBottom: i === users.length - 1 ? 4 : 0, borderRadius: 8, backgroundColor: filBy === u.username ? withAlpha(colors.primary, 0.15) : 'transparent' }}>
              <Text style={{ fontSize: FONTS.sub.size, color: filBy === u.username ? colors.primary : colors.textMain, fontWeight: filBy === u.username ? '700' : FONTS.sub.weight }}>{u.username}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        </View>
        </Animated.View>
      )}
      {/* List */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={50}
        contentContainerStyle={{ paddingTop: showFilter ? 200 : 4 }}>
        {loading ? (
          <LoadingSpinner />
        ) : records.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {records.map(renderCard)}
            {hasMore && (
              <View style={st.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={st.loadingMoreText}>{t('loading')}...</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
      {/* Detail Modal */}
      <ModalOverlay visible={!!selected} onClose={() => setSelected(null)} animation="springScale">
        {selectedRef.current && (() => { const r = selectedRef.current; return (
          <View style={[st.modal, { width: Dimensions.get('window').width * 0.9 }]}>
            {/* Header */}
            <View style={st.modalHeader}>
              <View>
                <Text style={st.modalDate}>{t('reconDate')}: {fmtDateTime(r.created_at || r.date)}</Text>
                <Text style={st.modalDateSub}>{t('billDate')}: {fmtDate(r.bill_date || r.date)}</Text>
                {r.reconciled_by ? (
                  <Text style={st.modalDateSub}>{t('reconciledBy')}: {r.reconciled_by}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                <Svg width="18" height="18" viewBox="0 0 24 24" stroke={colors.surface} strokeWidth="2" fill="none">
                  <Line x1="18" y1="6" x2="6" y2="18" />
                  <Line x1="6" y1="6" x2="18" y2="18" />
                </Svg>
              </TouchableOpacity>
            </View>
            {/* Three vertical pair groups */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <View style={st.pairRow}>
              {/* Group 1: 账面余额 / 卡余额 */}
              <View style={st.pairCol}>
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('bookBalance')}</Text>
                  <Text style={st.pairVal}>{fmtAmtFull(r.cash_on_hand)}</Text>
                </View>
                <View style={st.pairDivider} />
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('cardBalance')}</Text>
                  <Text style={st.pairVal}>{fmtAmtFull(r.card_balance)}</Text>
                </View>
              </View>
              {/* Group 2: 当前结余 / 现金 */}
              <View style={st.pairCol}>
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('currentBalance')}</Text>
                  <Text style={st.pairVal}>{fmtAmtFull(r.real_total)}</Text>
                </View>
                <View style={st.pairDivider} />
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('cashBalance')}</Text>
                  <Text style={st.pairVal}>{fmtAmtFull(r.cash_balance)}</Text>
                </View>
              </View>
              {/* Group 3: 账面差额 / 在途资金 */}
              <View style={st.pairCol}>
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('bookDiff')}</Text>
                  <Text style={[st.pairVal, { color: r.diff > 0.005 ? colors.success : r.diff < -0.005 ? colors.danger : colors.textMain }]}>
                    {r.diff >= 0 ? '+' : '-'}{fmtAmtFull(Math.abs(r.diff))}
                  </Text>
                </View>
                <View style={st.pairDivider} />
                <View style={st.pairItem}>
                  <Text style={st.pairLabel}>{t('fundsInTransit')}</Text>
                  <Text style={[st.pairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmtFull(r.channel_total)}</Text>
                </View>
              </View>
            </View>
            {/* Channel detail rows */}
            <View style={st.chanSection}>
              {[
                { label: t('dineIn'), value: r.dine_in },
                { label: t('meituan'), value: r.meituan },
                { label: t('flashSale'), value: r.flash_sale },
                { label: t('jd'), value: r.jd },
                { label: t('tuan'), value: r.tuan },
              ].map((ch, i) => (
                <View key={i} style={st.chanRow}>
                  <Text style={st.chanLabel}>{ch.label}</Text>
                  <Text style={st.chanVal}>{fmtAmtFull(ch.value)}</Text>
                </View>
              ))}
            </View>
            </ScrollView>
          </View>
        ); })()}
      </ModalOverlay>
    </View>
  );
}

const getSt = (colors: ThemeColors) => {
  const hdr = historyHeader(colors);
  return StyleSheet.create({
  root: { flex: 1 },
  ...hdr as any,
  header: { ...hdr.header, top: 0, paddingTop: 7, paddingBottom: 7, height: 50 },
  list: { flex: 1, paddingHorizontal: 12, marginTop: 50 },
  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
  /* Card */
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore

    gap: 10,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 8 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 2 },
  dateVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  dateSep: { width: 1, height: 24, backgroundColor: colors.secondary },
  /* Card vertical pairs — plain, no background */
  cardPairRow: { flexDirection: 'row', gap: 4 },
  cardPairCol: { flex: 1, alignItems: 'center' },
  cardPairItem: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  cardPairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  cardPairVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
  cardPairDiv: { height: 1, backgroundColor: colors.bg, width: '60%', marginVertical: 2 },
  tapHint: { fontSize: FONTS.micro.size, color: colors.primary, textAlign: 'center', marginTop: 2 },
  /* Modal */
  mask: {
    position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, justifyContent: 'center', alignItems: 'center',
  },
  maskBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: withAlpha(colors.textMain, 0.4),
  },
  modal: {
    backgroundColor: colors.surface, borderRadius: MODAL_CARD_RADIUS,
    overflow: 'hidden',
    // @ts-ignore

    // @ts-ignore

  },
  modalHeader: {
    backgroundColor: colors.primary,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 18,
  },
  modalDate: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  modalDateSub: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: withAlpha(colors.surface, 0.75), marginTop: 2 },
  modalClose: { ...modalClose, paddingLeft: 8 },
  /* Three vertical pairs */
  pairRow: {
    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 10,
    gap: 6,
  },
  pairCol: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  pairItem: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  pairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  pairVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
  pairDivider: { height: 1, backgroundColor: colors.secondary, width: '70%' },
  /* Channel section */
  chanSection: {
    marginHorizontal: 14, marginBottom: 18, marginTop: 4,
    borderTopWidth: 1, borderTopColor: colors.bg,
    paddingTop: 12,
  },
  chanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 4 },
  chanLabel: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight },
  chanVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
  /* Empty state */

  /* Filter — ultra-minimal */
  filterBtnText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
  filterBtnTextActive: { color: colors.surface },
  filterField: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  filterLabel: {
    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub,
    width: 64, flexShrink: 0,
  },
  filterDateRange: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  filterDateInput: {
    flex: 1,
    height: 34,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
    fontFamily: 'inherit',
    outline: 'none',
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
    opacity: 0.01,  width: '100%', height: '100%',
  },
  filterInput: {
    height: 34,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
  },
  filterSelectWrap: {
    flex: 1, position: 'relative',
    height: 34, paddingHorizontal: 8, justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
  },
  filterSelect: {
    width: '100%',
    height: 34,
    paddingLeft: 8,
    paddingRight: 30,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub,
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',

  },
  filterSelectArrow: {
    position: 'absolute',
    right: 8, top: 9,
    fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight,
    pointerEvents: 'none',
  },
  filterSelectText: {
    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub,
  },
  filterActions: {
    flexDirection: 'row', gap: 8, paddingTop: 6,
  },
  filterResetBtn: {
    flex: 1, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.secondary,
  },
  filterResetBtnText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
  filterApplyBtn: {
    flex: 1, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary,
  },
  filterApplyBtnDisabled: {
    backgroundColor: colors.secondary,
  },
  filterApplyBtnText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.surface },
  filterApplyBtnTextDisabled: {
    color: colors.textSub,
  },
  /* Reconciler in card */
  reconByRow: { alignItems: 'center', paddingBottom: 2 },
  reconByText: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
} as any);
};
