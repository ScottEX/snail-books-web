1|import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
2|import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native';
3|import Svg, { Path, Circle } from 'react-native-svg';
4|import { t, getLang } from '../i18n';
5|import { api } from '../api/client';
6|import { toDec2 } from "../utils/numbers";
7|import EmptyState from "../components/EmptyState";
8|import Toast from '../components/Toast';
9|import { useTheme, withAlpha, ThemeColors } from '../theme';
10|import { FONTS } from '../theme';
11|import { modalClose, historyHeader } from '../sharedStyles';
12|import DateErrorHint from '../components/DateErrorHint';
13|import { useSwipeBack } from '../hooks/useSwipeBack';
14|import BackArrow from '../components/icons/BackArrow';
15|
16|const PAGE_SIZE = 10;
17|
18|// Date helpers replaced by useServerDate() hook
19|const isFuture = (d: string) => d > sd.today;
20|// Strict calendar months between two ISO dates (YYYY-MM-DD)
21|function monthsBetween(from: string, to: string): number {
22|  const [fy, fm, fd] = from.split('-').map(Number);
23|  const [ty, tm, td] = to.split('-').map(Number);
24|  let m = (ty - fy) * 12 + (tm - fm);
25|  if (td < fd) m -= 1;
26|  return m;
27|}
28|
29|function RevenueEmptyIcon({ color }: { color: string }) {
30|  return (
31|    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
32|      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
33|      <Path d="M14 2v6h6" />
34|      <Path d="M7 15l4-4 2 2 4-5" />
35|      <circle cx="17" cy="8" r="1.2" fill={color} stroke="none" />
36|    </Svg>
37|  );
38|}
39|
40|export default function DailyRevenueHistory({ onBack }: { onBack: () => void }) {
41|  const [records, setRecords] = useState<any[]>([]);
42|  const swipeBack = useSwipeBack(onBack);
43|  const [page, setPage] = useState(1);
44|  const [total, setTotal] = useState(0);
45|  const [totalAll, setTotalAll] = useState(0);
46|  const [hasMore, setHasMore] = useState(false);
47|  const [loading, setLoading] = useState(true);
48|  const [toast, setToast] = useState('');
49|  const loadingRef = useRef(false);
50|  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
51|  // Uncontrolled date refs
52|  const dateFromRef = useRef<HTMLInputElement>(null);
53|  const dateToRef = useRef<HTMLInputElement>(null);
54|
55|  // Filter state
56|  const [showFilter, setShowFilter] = useState(false);
57|  const filterAnim = useRef(new Animated.Value(0)).current;
58|  const [filDateFrom, setFilDateFrom] = useState('');
59|    useEffect(() => { if (sd.ready && filDateFrom === '') setFilDateFrom(sd.offset(-30)); }, [sd.ready, sd.today, filDateFrom]);
60|  const [dateTo, setDateTo] = useState(sd.today);
61|  useEffect(() => { if (dateFromRef.current) dateFromRef.current.value = dateFrom; }, [dateFrom]);
62|  useEffect(() => { if (dateToRef.current) dateToRef.current.value = dateTo; }, [dateTo]);
63|  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
64|  const [appliedTo, setAppliedTo] = useState(dateTo);
65|  const [filterDateError, setFilterDateError] = useState(0);
66|  const [dateFromKey, setDateFromKey] = useState(0);
67|  const [dateToKey, setDateToKey] = useState(0);
68|
69|  const { colors, isDark } = useTheme();
70|    const sd = useServerDate();
71|
72|  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);
73|
74|  const rangeInvalid = useMemo(() =>
75|    !!(dateFrom && dateTo && dateFrom > dateTo),
76|    [dateFrom, dateTo]);
77|  // 24-month max-span guard (strict calendar months)
78|  const rangeTooLong = useMemo(() =>
79|    !!(dateFrom && dateTo && !rangeInvalid && monthsBetween(dateFrom, dateTo) > 24),
80|    [dateFrom, dateTo, rangeInvalid]);
81|
82|  // Server-side paginated load
83|  const loadPage = useCallback(async (pg: number, reset: boolean) => {
84|    if (loadingRef.current) return;
85|    loadingRef.current = true;
86|    if (reset) setLoading(true);
87|    try {
88|      const r: any = await api.getDailyRevenue(
89|        pg, PAGE_SIZE,
90|        undefined, undefined, undefined, undefined,
91|        appliedFrom || undefined,
92|        appliedTo || undefined,
93|      );
94|      const recs = r?.records || [];
95|      setRecords(prev => reset ? recs : [...prev, ...recs]);
96|      setPage(pg);
97|      setTotal(r?.total || 0);
98|      setTotalAll(r?.total_all ?? r?.total ?? 0);
99|      setHasMore(pg < (r?.pages || 1));
100|    } catch { setToast(t('toastLoadFailed')); }
101|    setLoading(false);
102|    loadingRef.current = false;
103|  }, [appliedFrom, appliedTo]);
104|
105|  // Reload when filter changes
106|  const filterKey = `${appliedFrom}|${appliedTo}`;
107|  useEffect(() => {
108|    setRecords([]);
109|    loadPage(1, true);
110|  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps
111|
112|  // Infinite scroll
113|  const handleScroll = useCallback((e: any) => {
114|    if (loadingRef.current || !hasMore) return;
115|    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
116|    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 60) {
117|      if (!scrollTimerRef.current) {
118|        scrollTimerRef.current = setTimeout(() => {
119|          scrollTimerRef.current = null;
120|          loadPage(page + 1, false);
121|        }, 150);
122|      }
123|    }
124|  }, [page, hasMore, loadPage]);
125|
126|  const fmtDate = (d: string) => {
127|    const [y, m, day] = d.split('-');
128|    const l = getLang();
129|    if (l.startsWith('en')) {
130|      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
131|      return `${months[+m-1]} ${+day}, ${y}`;
132|    }
133|    return `${y}/${m}/${day}`;
134|  };
135|
136|
137|
138|  const st = useMemo(() => getSt(colors), [colors]);
139|
140|  return (
141|    <View style={st.root} {...swipeBack}>
142|      {/* Header */}
143|      <View style={st.header}>
144|        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
145|          <View style={st.backBtn}>
146|            <BackArrow color={colors.primary} />
147|          </View>
148|        </TouchableOpacity>
149|        <Text style={st.title}>{t('revHistoryBtn')} ({total}/{totalAll})</Text>
150|        <TouchableOpacity
151|          style={[st.filterBtn, showFilter && st.filterBtnActive]}
152|          onPress={() => {
153|            if (!showFilter) {
154|              filterAnim.setValue(0);
155|              Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 170, friction: 26 }).start();
156|            }
157|            setShowFilter(!showFilter);
158|          }}
159|          activeOpacity={0.7}
160|        >
161|          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
162|            stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
163|            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
164|          </Svg>
165|        </TouchableOpacity>
166|      </View>
167|
168|      {/* Filter panel */}
169|      {showFilter && (<>
170|        <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, opacity: filterAnim }}>
171|          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => {
172|            Animated.timing(filterAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShowFilter(false));
173|          }} />
174|        </Animated.View>
175|        <Animated.View style={{
176|          position: 'fixed' as any, top: 108, left: 12, right: 12, zIndex: 9999,
177|          opacity: filterAnim,
178|          transform: [
179|            { translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
180|            { scale: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
181|          ],
182|        }}>
183|        <View style={st.filterPanel}>
184|          <View style={st.filterContent}>
185|            <DateErrorHint trigger={filterDateError} message={t('errDateFuture')} color={colors.danger} />
186|            {rangeInvalid && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRange')}</Text>}
187|            {rangeTooLong && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRangeTooLong')}</Text>}
188|            <View style={st.filterField}>
189|              <Text style={st.filterLabel}>{t('revenueDate')}</Text>
190|              <View style={st.filterDateRange}>
191|                <View style={st.filterDateWrap}>
192|                  {dateFrom ? (
193|                    <Text style={st.filterDateText}>{fmtDate(dateFrom)}</Text>
194|                  ) : (
195|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
196|                  )}
197|                  <input type="date" ref={dateFromRef} defaultValue={dateFrom} max={sd.today} key={dateFromKey}
198|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { dateFromRef.current!.value = dateFrom; setDateFromKey(k => k + 1); setFilterDateError(c => c + 1); } else { setDateFrom(e.target.value); } }}
199|                    style={st.filterDateHidden as any} />
200|                </View>
201|                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
202|                <View style={st.filterDateWrap}>
203|                  {dateTo ? (
204|                    <Text style={st.filterDateText}>{fmtDate(dateTo)}</Text>
205|                  ) : (
206|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
207|                  )}
208|                  <input type="date" ref={dateToRef} defaultValue={dateTo} max={sd.today} key={dateToKey}
209|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { dateToRef.current!.value = dateTo; setDateToKey(k => k + 1); setFilterDateError(c => c + 1); } else { setDateTo(e.target.value); } }}
210|                    style={st.filterDateHidden as any} />
211|                </View>
212|              </View>
213|            </View>
214|            <View style={st.filterActions}>
215|              <TouchableOpacity style={st.filterResetBtn} onPress={() => {
216|                const dFrom = sd.offset(-30);
217|                const dTo = sd.today;
218|                setDateFrom(dFrom);
219|                setDateTo(dTo);
220|                setAppliedFrom(dFrom);
221|                setAppliedTo(dTo);
222|              }} activeOpacity={0.7}>
223|                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
224|              </TouchableOpacity>
225|              <TouchableOpacity
226|                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
227|                disabled={rangeInvalid || rangeTooLong}
228|                onPress={() => {
229|                  setAppliedFrom(dateFrom);
230|                  setAppliedTo(dateTo);
231|                  setShowFilter(false);
232|                }} activeOpacity={0.8}>
233|                <Text style={[st.filterApplyBtnText, (rangeInvalid || rangeTooLong) && st.filterApplyBtnTextDisabled]}>{t('apply')}</Text>
234|              </TouchableOpacity>
235|            </View>
236|          </View>
237|        </View>
238|              </Animated.View>
239|      </>)}
240|
241|      {/* List */}
242|      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
243|        onScroll={handleScroll} scrollEventThrottle={50}
244|        contentContainerStyle={{ paddingTop: showFilter ? 166 : 112, paddingHorizontal: 16, paddingBottom: 100 }}>
245|        {loading ? (
246|          <View style={st.loading}>
247|            <ActivityIndicator size="large" color={colors.primary} />
248|            <Text style={st.loadingText}>{t('loading')}</Text>
249|          </View>
250|        ) : records.length === 0 ? (
251|          <EmptyState
252|            icon={<RevenueEmptyIcon color={colors.textSub} />}
253|            title={t('revEmpty')}
254|            hint={t('revEmptyHint')}
255|          />
256|        ) : (
257|          <>
258|            {records.map((rec: any, i: number) => (
259|              <View key={i} style={st.card}>
260|                <View style={st.cardTop}>
261|                  <Text style={st.cardDate}>{fmtDate(rec.date)}</Text>
262|                  <View style={[st.statusBadge, (rec.status === '未录入' || !rec.recorded_by) ? st.statusBadgeEmpty : st.statusBadgeDone]}>
263|                    <View style={[st.statusDot, (rec.status === '未录入' || !rec.recorded_by) ? st.statusDotEmpty : st.statusDotDone]} />
264|                    <Text style={[st.statusText, (rec.status === '未录入' || !rec.recorded_by) ? st.statusTextEmpty : st.statusTextDone]}>
265|                      {rec.status === '未录入' || !rec.recorded_by ? t('revNotEntered') : t('revEntered')}
266|                    </Text>
267|                  </View>
268|                </View>
269|
270|                {rec.archived ? (
271|                  <View style={st.archivedBadge}>
272|                    <Text style={st.archivedBadgeText}>{t('revMarkArchive')}</Text>
273|                  </View>
274|                ) : null}
275|
276|                <View style={st.cardAmounts}>
277|                  <View style={st.cardAmtCol}>
278|                    <Text style={[st.cardAmtVal, { color: rec.revenue > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.revenue)}</Text>
279|                    <Text style={st.cardAmtLabel}>{t('revRevenue')}</Text>
280|                  </View>
281|                  <View style={st.cardAmtCol}>
282|                    <Text style={[st.cardAmtVal, { color: rec.turnover > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.turnover)}</Text>
283|                    <Text style={st.cardAmtLabel}>{t('revTurnover')}</Text>
284|                  </View>
285|                  <View style={st.cardAmtCol}>
286|                    <Text style={[st.cardAmtVal, { color: rec.jd_revenue > 0 ? colors.textMain : colors.textSub }]}>¥{toDec2(rec.jd_revenue)}</Text>
287|                    <Text style={st.cardAmtLabel}>{t('revJD')}</Text>
288|                  </View>
289|                </View>
290|
291|                <View style={st.cardFooter}>
292|                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
293|                    <Text style={st.cardFooterText}>{t('recordedBy')}:</Text>
294|                    {rec.recorded_by ? (
295|                      <Text style={st.cardFooterText}>{rec.recorded_by}</Text>
296|                    ) : (
297|                      <Svg width={16} height={8} viewBox="0 0 16 8" fill="none" stroke={colors.secondary} strokeWidth={1.5} strokeLinecap="round">
298|                        <Path d="M2 4h12" />
299|                      </Svg>
300|                    )}
301|                  </View>
302|                </View>
303|                {rec.note ? (
304|                  <View style={st.cardNote}>
305|                    <Text style={st.cardNoteText}>{rec.note}</Text>
306|                  </View>
307|                ) : null}
308|              </View>
309|            ))}
310|            {hasMore && (
311|              <View style={st.loadingMore}>
312|                <ActivityIndicator size="small" color={colors.primary} />
313|                <Text style={st.loadingMoreText}>{t('loading')}...</Text>
314|              </View>
315|            )}
316|          </>
317|        )}
318|      </ScrollView>
319|
320|      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
321|    </View>
322|  );
323|}
324|
325|function fmtISO(d: Date) {
326|  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
327|}
328|
329|const getSt = (colors: ThemeColors) => StyleSheet.create({
330|  root: { flex: 1 },
331|  ...historyHeader(colors),
332|
333|  filterPanel: {
334|    backgroundColor: colors.surface, borderRadius: 10,
335|    borderWidth: 1, borderColor: colors.secondary, overflow: 'hidden',
336|  },
337|  filterContent: { padding: 12, gap: 8 },
338|  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
339|  filterLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub, width: 64, flexShrink: 0 },
340|  filterDateRange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
341|  filterDateWrap: {
342|    flex: 1, height: 34, position: 'relative' as any,
343|    backgroundColor: colors.surface, borderRadius: 6,
344|    borderWidth: 1, borderColor: colors.secondary,
345|    justifyContent: 'center', paddingHorizontal: 8,
346|  },
347|  filterDateText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
348|  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
349|  filterDateHidden: {
350|    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
351|    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
352|  },
353|  filterActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
354|  filterResetBtn: {
355|    flex: 1, alignItems: 'center', paddingVertical: 8,
356|    backgroundColor: colors.secondary, borderRadius: 8,
357|  },
358|  filterResetBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
359|  filterApplyBtn: {
360|    flex: 1, alignItems: 'center', paddingVertical: 8,
361|    backgroundColor: colors.primary, borderRadius: 8,
362|  },
363|  filterApplyBtnDisabled: { backgroundColor: colors.secondary },
364|  filterApplyBtnText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
365|  filterApplyBtnTextDisabled: { color: colors.textSub },
366|
367|  list: { flex: 1 },
368|
369|  card: {
370|    backgroundColor: colors.surface, borderRadius: 12,
371|    paddingVertical: 16, paddingHorizontal: 16,
372|    marginBottom: 10,
373|    borderWidth: 1, borderColor: colors.secondary,
374|    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
375|    gap: 12,
376|  } as any,
377|  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
378|  cardDate: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
379|  statusBadge: {
380|    flexDirection: 'row', alignItems: 'center',
381|    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5,
382|  },
383|  statusBadgeEmpty: { backgroundColor: withAlpha(colors.danger, 0.1) },
384|  statusBadgeDone: { backgroundColor: withAlpha(colors.success, 0.1) },
385|  statusDot: { width: 6, height: 6, borderRadius: 3 },
386|  statusDotEmpty: { backgroundColor: colors.danger },
387|  statusDotDone: { backgroundColor: colors.success },
388|  statusText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight },
389|  statusTextEmpty: { color: colors.danger },
390|  statusTextDone: { color: colors.success },
391|
392|  cardAmounts: {
393|    flexDirection: 'row', justifyContent: 'space-between',
394|    paddingVertical: 12, paddingHorizontal: 8,
395|    backgroundColor: colors.surface, borderRadius: 8,
396|  },
397|  cardAmtCol: { alignItems: 'center', flex: 1, gap: 4 },
398|  cardAmtVal: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight },
399|  cardAmtLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
400|
401|  cardFooter: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8 },
402|  cardFooterText: { fontSize: FONTS.micro.size, color: colors.textSub },
403|
404|  archivedBadge: {
405|    alignSelf: 'flex-start',
406|    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
407|    backgroundColor: withAlpha(colors.danger, 0.1),
408|  },
409|  archivedBadgeText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.danger },
410|
411|  cardNote: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8, marginTop: 4 },
412|  cardNoteText: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 16 },
413|
414|
415|
416|  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 40, gap: 8 },
417|  loadingText: { fontSize: FONTS.sub.size, color: colors.primary },
418|  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 8 },
419|  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
420|});
421|