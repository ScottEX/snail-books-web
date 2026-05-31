import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import { FilterBackdrop } from '../components/FilterBackdrop';
import Toast from '../components/Toast';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { modalCardAnimation, modalClose, historyHeader } from '../sharedStyles';

const PAGE_SIZE = 10;

export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');
  const touchRef = useRef({ startX: 0, startY: 0 });
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const { colors } = useTheme();
  const st = useMemo(() => getSt(colors), [colors]);

  const [showFilter, setShowFilter] = useState(false);
  const [filBillFrom, setFilBillFrom] = useState('');
  const [filBillTo, setFilBillTo] = useState('');
  const [filDateFrom, setFilDateFrom] = useState('');
  const [filDateTo, setFilDateTo] = useState('');
  const [filBy, setFilBy] = useState('');
  const [users, setUsers] = useState<{id: number; username: string}[]>([]);
  // Track applied filters (snapshot at last apply)
  const [appliedBillFrom, setAppliedBillFrom] = useState('');
  const [appliedBillTo, setAppliedBillTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedBy, setAppliedBy] = useState('');

  // Fetch users when filter panel opens
  useEffect(() => {
    if (showFilter && users.length === 0) {
      api.getUsers().then(data => setUsers(data || [])).catch(() => {});
    }
  }, [showFilter]);

  // Build filter params from applied values
  const getFilterParams = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {};
    if (appliedBillFrom) f.bill_date_from = appliedBillFrom;
    if (appliedBillTo) f.bill_date_to = appliedBillTo;
    if (appliedFrom) f.date_from = appliedFrom;
    if (appliedTo) f.date_to = appliedTo;
    if (appliedBy) f.reconciled_by = appliedBy;
    return f;
  }, [appliedBillFrom, appliedBillTo, appliedFrom, appliedTo, appliedBy]);

  const resetFilters = () => {
    setFilBillFrom(''); setFilBillTo('');
    setFilDateFrom(''); setFilDateTo('');
    setFilBy('');
    setAppliedBillFrom(''); setAppliedBillTo('');
    setAppliedFrom(''); setAppliedTo('');
    setAppliedBy('');
  };

  // Fetch one page from server (with current filters)
  const loadPage = useCallback(async (pg: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data: any = await api.getReconciliationsPage(pg, PAGE_SIZE, getFilterParams());
      const recs = data.records || [];
      setRecords(prev => reset ? recs : [...prev, ...recs]);
      setPage(pg);
      setTotal(data.total || 0);
      setHasMore(pg < (data.pages || 1));
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
    loadingRef.current = false;
  }, [getFilterParams]);

  // Trigger load when filter params change
  const filterKey = `${appliedBillFrom}|${appliedBillTo}|${appliedFrom}|${appliedTo}|${appliedBy}`;
  useEffect(() => {
    setRecords([]);
    loadPage(1, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll pagination
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
    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
    return `${y}/${m}/${day}`;
  };

  const fmtAmt = (n: number) => '\u00A5' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent?.touches?.[0] || e.nativeEvent;
    touchRef.current = { startX: t.pageX, startY: t.pageY };
  };
  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent?.changedTouches?.[0] || e.nativeEvent;
    const dx = t.pageX - touchRef.current.startX;
    const dy = Math.abs(t.pageY - touchRef.current.startY);
    if (touchRef.current.startX < 36 && dx > 80 && dx > dy * 1.5) onBack();
  };

  // Card: compact summary (tap to open detail modal)
  const renderCard = (r: any) => (
    <TouchableOpacity key={r.id} style={st.card} onPress={() => setSelected(r)} activeOpacity={0.7}>
      {/* Row 1: two dates */}
      <View style={st.dateRow}>
        <View style={st.dateItem}>
          <Text style={st.dateLabel}>{t('reconDate')}</Text>
          <Text style={st.dateVal}>{fmtDate(r.date)}</Text>
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
            <Text style={st.cardPairVal}>{fmtAmt(r.channel_total)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cardBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.card_balance)}</Text>
          </View>
        </View>
        {/* Col 2: 当前结余 / 现金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('currentBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.real_total)}</Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('cashBalance')}</Text>
            <Text style={st.cardPairVal}>{fmtAmt(r.cash_balance)}</Text>
          </View>
        </View>
        {/* Col 3: 账面差额 / 在途资金 */}
        <View style={st.cardPairCol}>
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('bookDiff')}</Text>
            <Text style={[st.cardPairVal, { color: Math.abs(r.diff) < 0.005 ? colors.textMain : colors.primary }]}>
              {r.diff >= 0 ? '+' : ''}{fmtAmt(Math.abs(r.diff))}
            </Text>
          </View>
          <View style={st.cardPairDiv} />
          <View style={st.cardPairItem}>
            <Text style={st.cardPairLabel}>{t('fundsInTransit')}</Text>
            <Text style={[st.cardPairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmt(r.channel_total)}</Text>
          </View>
        </View>
      </View>
      {/* Tap hint */}
      <Text style={st.tapHint}>{t('tapForDetail')}</Text>
    </TouchableOpacity>
  );

  // Detail Modal: three vertical pairs + channel list
  const renderModal = () => {
    if (!selected) return null;
    const r = selected;
    return (
      <View style={st.mask} onTouchStart={(e: any) => e.stopPropagation()}>
        <TouchableOpacity style={st.maskBg} activeOpacity={1} onPress={() => setSelected(null)} />
        <View style={st.modal}>
          {/* Header */}
          <View style={st.modalHeader}>
            <View>
              <Text style={st.modalDate}>{t('reconDate')}: {fmtDate(r.date)}</Text>
              <Text style={st.modalDateSub}>{t('billDate')}: {fmtDate(r.bill_date || r.date)}</Text>
              {r.reconciled_by ? (
                <Text style={st.modalDateSub}>{t('reconciledBy')}: {r.reconciled_by}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.6}>
              <Text style={st.modalClose}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
          {/* Three vertical pair groups */}
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <View style={st.pairRow}>
            {/* Group 1: 账面余额 / 卡余额 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('bookBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.channel_total)}</Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('cardBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.card_balance)}</Text>
              </View>
            </View>
            {/* Group 2: 当前结余 / 现金 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('currentBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.real_total)}</Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('cashBalance')}</Text>
                <Text style={st.pairVal}>{fmtAmt(r.cash_balance)}</Text>
              </View>
            </View>
            {/* Group 3: 账面差额 / 在途资金 */}
            <View style={st.pairCol}>
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('bookDiff')}</Text>
                <Text style={[st.pairVal, { color: Math.abs(r.diff) < 0.005 ? colors.textMain : colors.primary }]}>
                  {r.diff >= 0 ? '+' : ''}{fmtAmt(Math.abs(r.diff))}
                </Text>
              </View>
              <View style={st.pairDivider} />
              <View style={st.pairItem}>
                <Text style={st.pairLabel}>{t('fundsInTransit')}</Text>
                <Text style={[st.pairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmt(r.channel_total)}</Text>
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
                <Text style={st.chanVal}>{fmtAmt(ch.value)}</Text>
              </View>
            ))}
          </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={st.emptyWrap}>
      <View style={st.emptyIcon}><Text style={st.emptyEmoji}>{'\uD83D\uDCCB'}</Text></View>
      <Text style={st.emptyTitle}>{t('noRecords')}</Text>
      <Text style={st.emptyHint}>{t('emptyReconHint')}</Text>
    </View>
  );

  const validateReconDates = (): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const pairs: [string, string][] = [[filBillFrom, filBillTo], [filDateFrom, filDateTo]];
    for (const [from, to] of pairs) {
      if ((from && from > today) || (to && to > today)) { setToast(t('errDateFuture')); return false; }
      if (from && to && from > to) { setToast(t('errDateRange')); return false; }
    }
    return true;
  };

  return (
    <View style={st.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Toast */}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('reconHistory')} ({total})</Text>
        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => setShowFilter(!showFilter)} activeOpacity={0.7}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>
      {/* Filter bar */}
      {showFilter && (
        <>
          <FilterBackdrop onPress={() => setShowFilter(false)} />
          <View style={st.filterPanel}>
          <View style={st.filterContent}>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('billDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {filBillFrom ? (
                    <Text style={st.filterDateText}>{fmtDate(filBillFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filBillFrom} onChange={(e: any) => setFilBillFrom(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
                <View style={st.filterDateWrap}>
                  {filBillTo ? (
                    <Text style={st.filterDateText}>{fmtDate(filBillTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filBillTo} onChange={(e: any) => setFilBillTo(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
              </View>
            </View>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {filDateFrom ? (
                    <Text style={st.filterDateText}>{fmtDate(filDateFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filDateFrom} onChange={(e: any) => setFilDateFrom(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
                <View style={st.filterDateWrap}>
                  {filDateTo ? (
                    <Text style={st.filterDateText}>{fmtDate(filDateTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={filDateTo} onChange={(e: any) => setFilDateTo(e.target.value)}
                    style={st.filterDateHidden as any} />
                </View>
              </View>
            </View>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('reconciledBy')}</Text>
              <View style={st.filterSelectWrap}>
                <select value={filBy} onChange={(e: any) => setFilBy(e.target.value)}
                  style={st.filterSelect as any}>
                  <option value="">{t('any')}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.username}</option>
                  ))}
                </select>
                <Text style={st.filterSelectArrow}>▾</Text>
              </View>
            </View>
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.filterApplyBtn} onPress={() => {
                if (validateReconDates()) {
                  setAppliedBillFrom(filBillFrom);
                  setAppliedBillTo(filBillTo);
                  setAppliedFrom(filDateFrom);
                  setAppliedTo(filDateTo);
                  setAppliedBy(filBy);
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
      {/* List */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={50}
        contentContainerStyle={{ paddingTop: showFilter ? 230 : 76 }}>
        {loading ? (
          <View style={st.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.loadingText}>{t('loading')}</Text>
          </View>
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
        <View style={{ height: 100 }} />
      </ScrollView>
      {/* Detail Modal */}
      {renderModal()}
    </View>
  );
}

const getSt = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9F7F4' },
  ...historyHeader(colors),
  list: { flex: 1, paddingHorizontal: 12 },
  loading: { marginTop: 80, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: FONTS.sub.size, color: colors.primary },
  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
  /* Card */
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    gap: 10,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 8 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '500', marginBottom: 2 },
  dateVal: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.textSub },
  dateSep: { width: 1, height: 24, backgroundColor: colors.secondary },
  /* Card vertical pairs — plain, no background */
  cardPairRow: { flexDirection: 'row', gap: 4 },
  cardPairCol: { flex: 1, alignItems: 'center' },
  cardPairItem: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  cardPairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '500' },
  cardPairVal: { fontSize: FONTS.sub.size, fontWeight: '700', color: colors.textMain },
  cardPairDiv: { height: 1, backgroundColor: colors.bg, width: '60%', marginVertical: 2 },
  tapHint: { fontSize: FONTS.micro.size, color: colors.primary, textAlign: 'center', marginTop: 2 },
  /* Modal */
  mask: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, justifyContent: 'center', alignItems: 'center',
  },
  maskBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: withAlpha(colors.textMain, 0.4),
  },
  modal: {
    width: '88%', maxWidth: 380,
    backgroundColor: colors.surface, borderRadius: 20,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
    // @ts-ignore
    ...modalCardAnimation,
  },
  modalHeader: {
    backgroundColor: colors.primary,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 18,
  },
  modalDate: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.surface },
  modalDateSub: { fontSize: FONTS.micro.size, fontWeight: '400', color: withAlpha(colors.surface, 0.75), marginTop: 2 },
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
  pairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '500' },
  pairVal: { fontSize: FONTS.sub.size, fontWeight: '700', color: colors.textMain },
  pairDivider: { height: 1, backgroundColor: colors.secondary, width: '70%' },
  /* Channel section */
  chanSection: {
    marginHorizontal: 14, marginBottom: 18, marginTop: 4,
    borderTopWidth: 1, borderTopColor: colors.bg,
    paddingTop: 12,
  },
  chanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 4 },
  chanLabel: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: '500' },
  chanVal: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.textMain },
  /* Empty state */
  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.secondary },
  emptyEmoji: { fontSize: FONTS.h1.size },
  emptyTitle: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textSub },
  emptyHint: { fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  /* Filter — ultra-minimal */
  filterBtnText: { fontSize: FONTS.micro.size, fontWeight: '600', color: colors.textSub },
  filterBtnTextActive: { color: colors.surface },
  filterPanel: {
    position: 'absolute', top: 72, left: 12, right: 12, zIndex: 89,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.secondary,
    overflow: 'hidden',
    ...modalCardAnimation,
  },
  filterContent: {
    padding: 12, gap: 8,
  },
  filterField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  filterLabel: {
    fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textSub,
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
    fontSize: FONTS.sub.size, fontWeight: '400', color: colors.textSub,
    fontFamily: 'inherit',
    outline: 'none',
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
  filterInput: {
    height: 34,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: '400', color: colors.textSub,
  },
  filterSelectWrap: {
    flex: 1, position: 'relative',
  },
  filterSelect: {
    width: '100%',
    height: 34,
    paddingLeft: 8,
    paddingRight: 30,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    fontSize: FONTS.sub.size, fontWeight: '400', color: colors.textSub,
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer',
  },
  filterSelectArrow: {
    position: 'absolute',
    right: 8, top: 9,
    fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '600',
    pointerEvents: 'none',
  },
  filterActions: {
    flexDirection: 'row', gap: 8, paddingTop: 6,
  },
  filterResetBtn: {
    flex: 1, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.secondary,
  },
  filterResetBtnText: { fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textSub },
  filterApplyBtn: {
    flex: 1, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary,
  },
  filterApplyBtnText: { fontSize: FONTS.micro.size, fontWeight: '600', color: colors.surface },
  /* Reconciler in card */
  reconByRow: { alignItems: 'center', paddingBottom: 2 },
  reconByText: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '500' },
} as any);
