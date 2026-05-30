import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';

const PAGE_SIZE = 30;

export default function DailyRevenueHistory({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return fmtISO(d);
  });
  const [dateTo, setDateTo] = useState(() => fmtISO(new Date()));
  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
  const [appliedTo, setAppliedTo] = useState(dateTo);

  const { colors } = useTheme();

  const todayISO = fmtISO(new Date());

  // Build filter params
  const getFilterParams = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {};
    if (appliedFrom) f.date_from = appliedFrom;
    if (appliedTo) f.date_to = appliedTo;
    return f;
  }, [appliedFrom, appliedTo]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getDailyRevenue(1, 200);
      const all = (r.records || []) as any[];
      // Server-side filtering not implemented for daily_revenue, do client-side
      let filtered = all;
      if (appliedFrom) filtered = filtered.filter((rec: any) => rec.date >= appliedFrom);
      if (appliedTo) filtered = filtered.filter((rec: any) => rec.date <= appliedTo);
      setRecords(filtered);
    } catch { setToast(t('toastLoadFailed')); }
    setLoading(false);
  }, [appliedFrom, appliedTo]);

  // Reload when filter params change
  const filterKey = `${appliedFrom}|${appliedTo}`;
  useEffect(() => {
    setRecords([]);
    loadRecords();
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Date formatter — trilingual
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

  const validateDates = (): boolean => {
    const from = dateFrom, to = dateTo;
    if ((from && from > todayISO) || (to && to > todayISO)) { setToast(t('errDateFuture')); return false; }
    if (from && to && from > to) { setToast(t('errDateRange')); return false; }
    return true;
  };

  const st = useMemo(() => getSt(colors), [colors]);

  return (
    <View style={st.root}>
      {/* Header — absolute frosted glass, matches ExpenseHistoryScreen */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <Text style={st.backArrow}>{'\u2039'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('revHistoryBtn')} ({records.length})</Text>
        <TouchableOpacity
          style={[st.filterBtn, showFilter && st.filterBtnActive]}
          onPress={() => setShowFilter(!showFilter)}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Filter panel — matches ReconHistoryScreen */}
      {showFilter && (
        <View style={st.filterPanel}>
          <View style={st.filterContent}>
            <View style={st.filterField}>
              <Text style={st.filterLabel}>{t('filterDate')}</Text>
              <View style={st.filterDateRange}>
                <View style={st.filterDateWrap}>
                  {dateFrom ? (
                    <Text style={st.filterDateText}>{fmtDate(dateFrom)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={dateFrom} max={todayISO}
                    onChange={(e: any) => { const v = e.target.value; if (v <= todayISO) setDateFrom(v); }}
                    style={st.filterDateHidden as any} />
                </View>
                <Text style={st.filterDateArrow}>→</Text>
                <View style={st.filterDateWrap}>
                  {dateTo ? (
                    <Text style={st.filterDateText}>{fmtDate(dateTo)}</Text>
                  ) : (
                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
                  )}
                  <input type="date" value={dateTo} max={todayISO}
                    onChange={(e: any) => { const v = e.target.value; if (v <= todayISO) setDateTo(v); }}
                    style={st.filterDateHidden as any} />
                </View>
              </View>
            </View>
            <View style={st.filterActions}>
              <TouchableOpacity style={st.filterResetBtn} onPress={() => {
                const d = new Date(); d.setMonth(d.getMonth() - 1);
                setDateFrom(fmtISO(d)); setDateTo(fmtISO(new Date()));
                setAppliedFrom(fmtISO(d)); setAppliedTo(fmtISO(new Date()));
              }} activeOpacity={0.7}>
                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.filterApplyBtn} onPress={() => {
                if (validateDates()) {
                  setAppliedFrom(dateFrom);
                  setAppliedTo(dateTo);
                  setShowFilter(false);
                }
              }} activeOpacity={0.8}>
                <Text style={st.filterApplyBtnText}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* List — card-based layout */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: showFilter ? 150 : 76, paddingHorizontal: 16, paddingBottom: 80 }}>
        {loading ? (
          <View style={st.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.loadingText}>{t('loading')}</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}><Text style={st.emptyEmoji}>{'\uD83D\uDCCB'}</Text></View>
            <Text style={st.emptyTitle}>{t('revEmpty')}</Text>
            <Text style={st.emptyHint}>{t('revEmptyHint')}</Text>
          </View>
        ) : (
          records.map((rec: any, i: number) => (
            <View key={i} style={st.card}>
              {/* Top row: date + status badge */}
              <View style={st.cardTop}>
                <Text style={st.cardDate}>{fmtDate(rec.date)}</Text>
                <View style={[st.statusBadge, (rec.status === '未录入' || !rec.recorded_by) ? st.statusBadgeEmpty : st.statusBadgeDone]}>
                  <View style={[st.statusDot, (rec.status === '未录入' || !rec.recorded_by) ? st.statusDotEmpty : st.statusDotDone]} />
                  <Text style={[st.statusText, (rec.status === '未录入' || !rec.recorded_by) ? st.statusTextEmpty : st.statusTextDone]}>
                    {rec.status === '未录入' || !rec.recorded_by ? t('revNotEntered') : t('revEntered')}
                  </Text>
                </View>
              </View>

              {/* Archived badge */}
              {rec.archived ? (
                <View style={st.archivedBadge}>
                  <Text style={st.archivedBadgeText}>{t('revMarkArchive')}</Text>
                </View>
              ) : null}

              {/* Amount row: three columns */}
              <View style={st.cardAmounts}>
                <View style={st.cardAmtCol}>
                  {rec.revenue > 0 ? (
                    <Text style={[st.cardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.revenue)}</Text>
                  ) : (
                    <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                      <Path d="M4 6h16" />
                    </Svg>
                  )}
                  <Text style={st.cardAmtLabel}>{t('revRevenue')}</Text>
                </View>
                <View style={st.cardAmtCol}>
                  {rec.turnover > 0 ? (
                    <Text style={[st.cardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.turnover)}</Text>
                  ) : (
                    <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                      <Path d="M4 6h16" />
                    </Svg>
                  )}
                  <Text style={st.cardAmtLabel}>{t('revTurnover')}</Text>
                </View>
                <View style={st.cardAmtCol}>
                  {rec.jd_revenue > 0 ? (
                    <Text style={[st.cardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.jd_revenue)}</Text>
                  ) : (
                    <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                      <Path d="M4 6h16" />
                    </Svg>
                  )}
                  <Text style={st.cardAmtLabel}>{t('revJD')}</Text>
                </View>
              </View>

              {/* Footer: recorded by */}
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
              {/* Note */}
              {rec.note ? (
                <View style={st.cardNote}>
                  <Text style={st.cardNoteText}>{rec.note}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Nav — tap any tab → back to main */}
      <View style={st.bottomNav}>
        {['➕', '📋', '📦', '📊', '👤'].map((icon, i) => (
          <TouchableOpacity key={i} style={st.navItem} onPress={onBack} activeOpacity={0.7}>
            <Text style={st.navIcon}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getSt = (colors: ThemeColors) => StyleSheet.create({
  /* Root */
  root: { flex: 1 },

  /* Header — frosted glass, matches ExpenseHistoryScreen */
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: withAlpha(colors.bg, 0.55),
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: withAlpha(colors.bg, 0.30),
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
  },
  backArrow: { fontSize: FONTS.h1.size, fontWeight: '300', color: colors.primary, marginTop: -2, marginLeft: -1 },
  title: { fontSize: FONTS.body.size, fontWeight: '400', color: colors.textMain },

  /* Filter button */
  filterBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: withAlpha(colors.bg, 0.30),
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)',
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  /* Filter panel — matches ReconHistoryScreen */
  filterPanel: {
    position: 'absolute', top: 72, left: 12, right: 12, zIndex: 89,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.secondary,
    overflow: 'hidden',
  },
  filterContent: { padding: 12, gap: 8 },
  filterField: { gap: 3 },
  filterLabel: { fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textSub, paddingLeft: 2 },
  filterDateRange: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterDateWrap: {
    flex: 1, height: 34, position: 'relative' as any,
    backgroundColor: colors.surface, borderRadius: 6,
    borderWidth: 1, borderColor: colors.secondary,
    justifyContent: 'center', paddingHorizontal: 8,
  },
  filterDateText: { fontSize: FONTS.micro.size, fontWeight: '500', color: colors.textMain },
  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: '400', color: colors.textSub },
  filterDateHidden: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
  },
  filterDateArrow: { fontSize: FONTS.micro.size, color: colors.secondary, fontWeight: '300', marginHorizontal: 2 },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterResetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.secondary, borderRadius: 8,
  },
  filterResetBtnText: { fontSize: FONTS.sub.size, fontWeight: '500', color: colors.textMain },
  filterApplyBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.primary, borderRadius: 8,
  },
  filterApplyBtnText: { fontSize: FONTS.sub.size, fontWeight: '700', color: colors.surface },

  /* List */
  list: { flex: 1 },

  /* Card */
  card: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    gap: 12,
  },
  /* Card top: date + status */
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardDate: { fontSize: FONTS.body.size, fontWeight: '600', color: colors.textMain },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5,
  },
  statusBadgeEmpty: { backgroundColor: withAlpha(colors.danger, 0.1) },
  statusBadgeDone: { backgroundColor: withAlpha(colors.success, 0.1) },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotEmpty: { backgroundColor: colors.danger },
  statusDotDone: { backgroundColor: colors.success },
  statusText: { fontSize: FONTS.micro.size, fontWeight: '600' },
  statusTextEmpty: { color: colors.danger },
  statusTextDone: { color: colors.success },

  /* Amount row */
  cardAmounts: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: colors.surface, borderRadius: 8,
  },
  cardAmtCol: { alignItems: 'center', flex: 1, gap: 4 },
  cardAmtVal: { fontSize: FONTS.h2.size, fontWeight: '700' },
  cardAmtLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: '500' },

  /* Footer */
  cardFooter: {
    borderTopWidth: 0.5, borderTopColor: colors.secondary,
    paddingTop: 8,
  },
  cardFooterText: { fontSize: FONTS.micro.size, color: colors.textSub },

  /* Archived badge */
  archivedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  archivedBadgeText: { fontSize: FONTS.micro.size, fontWeight: '600', color: colors.danger },

  /* Note display */
  cardNote: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8, marginTop: 4 },
  cardNoteText: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 16 },

  /* Empty state */
  emptyWrap: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.secondary },
  emptyEmoji: { fontSize: FONTS.h1.size },
  emptyTitle: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textSub },
  emptyHint: { fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  /* Loading */
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 40, gap: 8 },
  loadingText: { fontSize: FONTS.sub.size, color: colors.primary },

  /* Bottom Nav */
  bottomNav: {
    position: 'fixed' as any,
    bottom: 16, left: '50%',
    transform: 'translateX(-50%)' as any,
    flexDirection: 'row', gap: 6,
    backgroundColor: withAlpha(colors.bg, 0.60),
    borderRadius: 28, paddingVertical: 6, paddingHorizontal: 8,
    // @ts-ignore
    backdropFilter: 'saturate(200%) blur(30px)',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
    zIndex: 100,
  },
  navItem: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  navIcon: { fontSize: FONTS.amount.size },
});
