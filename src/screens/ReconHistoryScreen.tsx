1|import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
2|import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native';
3|import Svg, { Path, Rect, Circle } from 'react-native-svg';
4|import { t, getLang } from '../i18n';
5|import { useSwipeBack } from '../hooks/useSwipeBack';
6|import { api } from '../api/client';
7|import { useServerDate } from '../hooks/useServerDate';
8|import Toast from '../components/Toast';
9|import EmptyState from '../components/EmptyState';
10|import { useTheme, withAlpha, ThemeColors } from '../theme';
11|import { FONTS } from '../theme';
12|import { modalCardAnimation, modalClose, historyHeader } from '../sharedStyles';
13|import { fmtAmtFull } from '../utils/format';
14|import DateErrorHint from '../components/DateErrorHint';
15|import BackArrow from '../components/icons/BackArrow';
16|
17|const PAGE_SIZE = 10;
18|
19|// Date helpers replaced by useServerDate() hook
20|const isFuture = (d: string) => d > sd.today;
21|// Strict calendar months between two ISO dates (YYYY-MM-DD)
22|function monthsBetween(from: string, to: string): number {
23|  const [fy, fm, fd] = from.split('-').map(Number);
24|  const [ty, tm, td] = to.split('-').map(Number);
25|  let m = (ty - fy) * 12 + (tm - fm);
26|  if (td < fd) m -= 1;
27|  return m;
28|}
29|
30|function ReconEmptyIcon({ color }: { color: string }) {
31|  return (
32|    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
33|      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
34|      <Path d="M9 12l2 2 4-4" />
35|    </Svg>
36|  );
37|}
38|
39|export default function ReconHistoryScreen({ onBack }: { onBack: () => void }) {
40|  const [records, setRecords] = useState<any[]>([]);
41|  const [page, setPage] = useState(1);
42|  const [total, setTotal] = useState(0);
43|  const [totalAll, setTotalAll] = useState(0);
44|  const [hasMore, setHasMore] = useState(false);
45|  const [loading, setLoading] = useState(true);
46|  const [selected, setSelected] = useState<any>(null);
47|  const [toast, setToast] = useState('');
48|  const swipeBack = useSwipeBack(onBack);
49|  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
50|  const loadingRef = useRef(false);
51|  // Uncontrolled date refs — React Native Web <input type="date"> crashes with controlled value={state}
52|  const filDateFromRef = useRef<HTMLInputElement>(null);
53|  const filDateToRef = useRef<HTMLInputElement>(null);
54|
55|  const { colors, isDark } = useTheme();
56|    const sd = useServerDate();
57|  const st = useMemo(() => getSt(colors), [colors]);
58|
59|  const [showFilter, setShowFilter] = useState(false);
60|  const filterAnim = useRef(new Animated.Value(0)).current;
61|  const [filDateFrom, setFilDateFrom] = useState('');
62|  useEffect(() => { if (sd.ready && filDateFrom === '') setFilDateFrom(sd.offset(-30)); }, [sd.ready, sd.today, filDateFrom]);
63|  const [filDateTo, setFilDateTo] = useState('');
64|  useEffect(() => { if (sd.ready && filDateTo === '') setFilDateTo(sd.today); }, [sd.ready, sd.today, filDateTo]);
65|  useEffect(() => { if (filDateFromRef.current) filDateFromRef.current.value = filDateFrom; }, [filDateFrom]);
66|  useEffect(() => { if (filDateToRef.current) filDateToRef.current.value = filDateTo; }, [filDateTo]);
67|  const [filBy, setFilBy] = useState('');
68|  const [users, setUsers] = useState<{id: number; username: string}[]>([]);
69|  // Track applied filters (snapshot at last apply)
70|  const [appliedFrom, setAppliedFrom] = useState('');
71|  useEffect(() => { if (sd.ready && appliedFrom === '') setAppliedFrom(sd.offset(-30)); }, [sd.ready, sd.today, appliedFrom]);
72|  const [appliedTo, setAppliedTo] = useState('');
73|  useEffect(() => { if (sd.ready && appliedTo === '') setAppliedTo(sd.today); }, [sd.ready, sd.today, appliedTo]);
74|  const [appliedBy, setAppliedBy] = useState('');
75|  const [filterDateError, setFilterDateError] = useState(0);
76|  const [filDateFromKey, setFilDateFromKey] = useState(0);
77|  const [filDateToKey, setFilDateToKey] = useState(0);
78|
79|  // Reset error when filter panel opens
80|  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);
81|
82|  // Date range validity — persistent hint while invalid
83|  const rangeInvalid = useMemo(() =>
84|    (!!filDateFrom && !!filDateTo && filDateFrom > filDateTo),
85|    [filDateFrom, filDateTo]);
86|  // 24-month max-span guard (strict calendar months)
87|  const rangeTooLong = useMemo(() =>
88|    (!!filDateFrom && !!filDateTo && !rangeInvalid && monthsBetween(filDateFrom, filDateTo) > 24),
89|    [filDateFrom, filDateTo, rangeInvalid]);
90|
91|  // Fetch users when filter panel opens
92|  useEffect(() => {
93|    if (showFilter && users.length === 0) {
94|      api.getUsers().then(data => setUsers(data || [])).catch(() => {});
95|    }
96|  }, [showFilter]);
97|
98|  // Build filter params from applied values
99|  const getFilterParams = useCallback((): Record<string, string> => {
100|    const f: Record<string, string> = {};
101|    if (appliedFrom) f.date_from = appliedFrom;
102|    if (appliedTo) f.date_to = appliedTo;
103|    if (appliedBy) f.reconciled_by = appliedBy;
104|    return f;
105|  }, [appliedFrom, appliedTo, appliedBy]);
106|
107|  const resetFilters = () => {
108|    const dFrom = sd.offset(-30);
109|    const dTo = sd.today;
110|    setFilDateFrom(dFrom);
111|    setFilDateTo(dTo);
112|    setFilBy('');
113|    setAppliedFrom(dFrom);
114|    setAppliedTo(dTo);
115|    setAppliedBy('');
116|  };
117|
118|  // Fetch one page from server (with current filters)
119|  const loadPage = useCallback(async (pg: number, reset: boolean) => {
120|    if (loadingRef.current) return;
121|    loadingRef.current = true;
122|    if (reset) setLoading(true);
123|    try {
124|      const data: any = await api.getReconciliationsPage(pg, PAGE_SIZE, getFilterParams());
125|      const recs = data?.records || [];
126|      setRecords(prev => reset ? recs : [...prev, ...recs]);
127|      setPage(pg);
128|      setTotal(data?.total || 0);
129|      setTotalAll(data?.total_all ?? data?.total ?? 0);
130|      setHasMore(pg < (data?.pages || 1));
131|    } catch { setToast(t('toastLoadFailed')); }
132|    setLoading(false);
133|    loadingRef.current = false;
134|  }, [getFilterParams]);
135|
136|  // Trigger load when filter params change
137|  const filterKey = `${appliedFrom}|${appliedTo}|${appliedBy}`;
138|  useEffect(() => {
139|    setRecords([]);
140|    loadPage(1, true);
141|  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps
142|
143|  // Scroll pagination
144|  const handleScroll = useCallback((e: any) => {
145|    if (loadingRef.current || !hasMore) return;
146|    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
147|    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 60) {
148|      if (!scrollTimerRef.current) {
149|        scrollTimerRef.current = setTimeout(() => {
150|          scrollTimerRef.current = null;
151|          loadPage(page + 1, false);
152|        }, 150);
153|      }
154|    }
155|  }, [page, hasMore, loadPage]);
156|
157|  const fmtDate = (d: string) => {
158|    const [y, m, day] = d.split('-');
159|    const l = getLang();
160|    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
161|    return `${y}/${m}/${day}`;
162|  };
163|
164|
165|
166|  // Card: compact summary (tap to open detail modal)
167|  const renderCard = (r: any) => (
168|    <TouchableOpacity key={r.id} style={st.card} onPress={() => setSelected(r)} activeOpacity={0.7}>
169|      {/* Row 1: two dates */}
170|      <View style={st.dateRow}>
171|        <View style={st.dateItem}>
172|          <Text style={st.dateLabel}>{t('reconDate')}</Text>
173|          <Text style={st.dateVal}>{fmtDate(r.date)}</Text>
174|        </View>
175|        <View style={st.dateSep} />
176|        <View style={st.dateItem}>
177|          <Text style={st.dateLabel}>{t('billDate')}</Text>
178|          <Text style={st.dateVal}>{fmtDate(r.bill_date || r.date)}</Text>
179|        </View>
180|      </View>
181|      {/* Reconciler */}
182|      {r.reconciled_by ? (
183|        <View style={st.reconByRow}>
184|          <Text style={st.reconByText}>{t('reconciledBy')}: {r.reconciled_by}</Text>
185|        </View>
186|      ) : null}
187|      {/* Row 2: 3 vertical pair columns */}
188|      <View style={st.cardPairRow}>
189|        {/* Col 1: 账面余额 / 卡余额 */}
190|        <View style={st.cardPairCol}>
191|          <View style={st.cardPairItem}>
192|            <Text style={st.cardPairLabel}>{t('bookBalance')}</Text>
193|            <Text style={st.cardPairVal}>{fmtAmtFull(r.channel_total)}</Text>
194|          </View>
195|          <View style={st.cardPairDiv} />
196|          <View style={st.cardPairItem}>
197|            <Text style={st.cardPairLabel}>{t('cardBalance')}</Text>
198|            <Text style={st.cardPairVal}>{fmtAmtFull(r.card_balance)}</Text>
199|          </View>
200|        </View>
201|        {/* Col 2: 当前结余 / 现金 */}
202|        <View style={st.cardPairCol}>
203|          <View style={st.cardPairItem}>
204|            <Text style={st.cardPairLabel}>{t('currentBalance')}</Text>
205|            <Text style={st.cardPairVal}>{fmtAmtFull(r.real_total)}</Text>
206|          </View>
207|          <View style={st.cardPairDiv} />
208|          <View style={st.cardPairItem}>
209|            <Text style={st.cardPairLabel}>{t('cashBalance')}</Text>
210|            <Text style={st.cardPairVal}>{fmtAmtFull(r.cash_balance)}</Text>
211|          </View>
212|        </View>
213|        {/* Col 3: 账面差额 / 在途资金 */}
214|        <View style={st.cardPairCol}>
215|          <View style={st.cardPairItem}>
216|            <Text style={st.cardPairLabel}>{t('bookDiff')}</Text>
217|            <Text style={[st.cardPairVal, { color: Math.abs(r.diff) < 0.005 ? colors.textMain : colors.primary }]}>
218|              {r.diff >= 0 ? '+' : ''}{fmtAmtFull(Math.abs(r.diff))}
219|            </Text>
220|          </View>
221|          <View style={st.cardPairDiv} />
222|          <View style={st.cardPairItem}>
223|            <Text style={st.cardPairLabel}>{t('fundsInTransit')}</Text>
224|            <Text style={[st.cardPairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmtFull(r.channel_total)}</Text>
225|          </View>
226|        </View>
227|      </View>
228|      {/* Tap hint */}
229|      <Text style={st.tapHint}>{t('tapForDetail')}</Text>
230|    </TouchableOpacity>
231|  );
232|
233|  // Detail Modal: three vertical pairs + channel list
234|  const renderModal = () => {
235|    if (!selected) return null;
236|    const r = selected;
237|    return (
238|      <View style={st.mask} onTouchStart={(e: any) => e.stopPropagation()}>
239|        <TouchableOpacity style={st.maskBg} activeOpacity={1} onPress={() => setSelected(null)} />
240|        <View style={st.modal}>
241|          {/* Header */}
242|          <View style={st.modalHeader}>
243|            <View>
244|              <Text style={st.modalDate}>{t('reconDate')}: {fmtDate(r.date)}</Text>
245|              <Text style={st.modalDateSub}>{t('billDate')}: {fmtDate(r.bill_date || r.date)}</Text>
246|              {r.reconciled_by ? (
247|                <Text style={st.modalDateSub}>{t('reconciledBy')}: {r.reconciled_by}</Text>
248|              ) : null}
249|            </View>
250|            <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.6}>
251|              <Text style={st.modalClose}>{'\u2715'}</Text>
252|            </TouchableOpacity>
253|          </View>
254|          {/* Three vertical pair groups */}
255|          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
256|          <View style={st.pairRow}>
257|            {/* Group 1: 账面余额 / 卡余额 */}
258|            <View style={st.pairCol}>
259|              <View style={st.pairItem}>
260|                <Text style={st.pairLabel}>{t('bookBalance')}</Text>
261|                <Text style={st.pairVal}>{fmtAmtFull(r.channel_total)}</Text>
262|              </View>
263|              <View style={st.pairDivider} />
264|              <View style={st.pairItem}>
265|                <Text style={st.pairLabel}>{t('cardBalance')}</Text>
266|                <Text style={st.pairVal}>{fmtAmtFull(r.card_balance)}</Text>
267|              </View>
268|            </View>
269|            {/* Group 2: 当前结余 / 现金 */}
270|            <View style={st.pairCol}>
271|              <View style={st.pairItem}>
272|                <Text style={st.pairLabel}>{t('currentBalance')}</Text>
273|                <Text style={st.pairVal}>{fmtAmtFull(r.real_total)}</Text>
274|              </View>
275|              <View style={st.pairDivider} />
276|              <View style={st.pairItem}>
277|                <Text style={st.pairLabel}>{t('cashBalance')}</Text>
278|                <Text style={st.pairVal}>{fmtAmtFull(r.cash_balance)}</Text>
279|              </View>
280|            </View>
281|            {/* Group 3: 账面差额 / 在途资金 */}
282|            <View style={st.pairCol}>
283|              <View style={st.pairItem}>
284|                <Text style={st.pairLabel}>{t('bookDiff')}</Text>
285|                <Text style={[st.pairVal, { color: Math.abs(r.diff) < 0.005 ? colors.textMain : colors.primary }]}>
286|                  {r.diff >= 0 ? '+' : ''}{fmtAmtFull(Math.abs(r.diff))}
287|                </Text>
288|              </View>
289|              <View style={st.pairDivider} />
290|              <View style={st.pairItem}>
291|                <Text style={st.pairLabel}>{t('fundsInTransit')}</Text>
292|                <Text style={[st.pairVal, { color: (Math.abs(r.channel_total) < 0.005) ? colors.textMain : colors.primary }]}>{fmtAmtFull(r.channel_total)}</Text>
293|              </View>
294|            </View>
295|          </View>
296|          {/* Channel detail rows */}
297|          <View style={st.chanSection}>
298|            {[
299|              { label: t('dineIn'), value: r.dine_in },
300|              { label: t('meituan'), value: r.meituan },
301|              { label: t('flashSale'), value: r.flash_sale },
302|              { label: t('jd'), value: r.jd },
303|              { label: t('tuan'), value: r.tuan },
304|            ].map((ch, i) => (
305|              <View key={i} style={st.chanRow}>
306|                <Text style={st.chanLabel}>{ch.label}</Text>
307|                <Text style={st.chanVal}>{fmtAmtFull(ch.value)}</Text>
308|              </View>
309|            ))}
310|          </View>
311|          </ScrollView>
312|        </View>
313|      </View>
314|    );
315|  };
316|
317|  const renderEmpty = () => (
318|    <EmptyState
319|      icon={<ReconEmptyIcon color={colors.textSub} />}
320|      title={t('noRecords')}
321|      hint={t('emptyReconHint')}
322|    />
323|  );
324|
325|  const todayISO = sd.today;
326|
327|  return (
328|    <View style={st.root} {...swipeBack}>
329|      {/* Toast */}
330|      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
331|      {/* Header */}
332|      <View style={st.header}>
333|        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
334|          <View style={st.backBtn}>
335|            <BackArrow color={colors.primary} />
336|          </View>
337|        </TouchableOpacity>
338|        <Text style={st.title}>{t('reconHistory')} ({total}/{totalAll})</Text>
339|        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => {
340|            if (!showFilter) {
341|              filterAnim.setValue(0);
342|              Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 170, friction: 26 }).start();
343|            }
344|            setShowFilter(!showFilter);
345|          }} activeOpacity={0.7}>
346|          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
347|            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
348|          </Svg>
349|        </TouchableOpacity>
350|      </View>
351|      {/* Filter bar */}
352|      {showFilter && (<>
353|        <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, opacity: filterAnim }}>
354|          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => {
355|            Animated.timing(filterAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShowFilter(false));
356|          }} />
357|        </Animated.View>
358|        <Animated.View style={{
359|          position: 'fixed' as any, top: 108, left: 12, right: 12, zIndex: 9999,
360|          opacity: filterAnim,
361|          transform: [
362|            { translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
363|            { scale: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
364|          ],
365|        }}>
366|        <View style={st.filterPanel}>
367|          <View style={st.filterContent}>
368|            <DateErrorHint trigger={filterDateError} message={t('errDateFuture')} color={colors.danger} />
369|            {rangeInvalid && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRange')}</Text>}
370|            {rangeTooLong && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRangeTooLong')}</Text>}
371|            <View style={st.filterField}>
372|              <Text style={st.filterLabel}>{t('reconDate')}</Text>
373|              <View style={st.filterDateRange}>
374|                <View style={st.filterDateWrap}>
375|                  {filDateFrom ? (
376|                    <Text style={st.filterDateText}>{fmtDate(filDateFrom)}</Text>
377|                  ) : (
378|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
379|                  )}
380|                  <input type="date" ref={filDateFromRef} defaultValue={filDateFrom} max={todayISO} key={filDateFromKey}
381|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { filDateFromRef.current!.value = filDateFrom; setFilDateFromKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateFrom(e.target.value); } }}
382|                    style={st.filterDateHidden as any} />
383|                </View>
384|                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
385|                <View style={st.filterDateWrap}>
386|                  {filDateTo ? (
387|                    <Text style={st.filterDateText}>{fmtDate(filDateTo)}</Text>
388|                  ) : (
389|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
390|                  )}
391|                  <input type="date" ref={filDateToRef} defaultValue={filDateTo} max={todayISO} key={filDateToKey}
392|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { filDateToRef.current!.value = filDateTo; setFilDateToKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateTo(e.target.value); } }}
393|                    style={st.filterDateHidden as any} />
394|                </View>
395|              </View>
396|            </View>
397|            <View style={st.filterField}>
398|              <Text style={st.filterLabel}>{t('reconciledBy')}</Text>
399|              <View style={st.filterSelectWrap}>
400|                <select value={filBy} onChange={(e: any) => setFilBy(e.target.value)}
401|                  style={st.filterSelect as any}>
402|                  <option value="">{t('any')}</option>
403|                  {users.map(u => (
404|                    <option key={u.id} value={u.username}>{u.username}</option>
405|                  ))}
406|                </select>
407|                <Text style={st.filterSelectArrow}>▾</Text>
408|              </View>
409|            </View>
410|            <View style={st.filterActions}>
411|              <TouchableOpacity style={st.filterResetBtn} onPress={resetFilters} activeOpacity={0.7}>
412|                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
413|              </TouchableOpacity>
414|              <TouchableOpacity
415|                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
416|                disabled={rangeInvalid || rangeTooLong}
417|                onPress={() => {
418|                  setAppliedFrom(filDateFrom);
419|                  setAppliedTo(filDateTo);
420|                  setAppliedBy(filBy);
421|                  setShowFilter(false);
422|              }} activeOpacity={0.8}>
423|                <Text style={[st.filterApplyBtnText, (rangeInvalid || rangeTooLong) && st.filterApplyBtnTextDisabled]}>{t('apply')}</Text>
424|              </TouchableOpacity>
425|            </View>
426|          </View>
427|        </View>
428|        </Animated.View>
429|      </>)}
430|      {/* List */}
431|      <ScrollView style={st.list} showsVerticalScrollIndicator={false}
432|        onScroll={handleScroll} scrollEventThrottle={50}
433|        contentContainerStyle={{ paddingTop: showFilter ? 266 : 112 }}>
434|        {loading ? (
435|          <View style={st.loading}>
436|            <ActivityIndicator size="large" color={colors.primary} />
437|            <Text style={st.loadingText}>{t('loading')}</Text>
438|          </View>
439|        ) : records.length === 0 ? (
440|          renderEmpty()
441|        ) : (
442|          <>
443|            {records.map(renderCard)}
444|            {hasMore && (
445|              <View style={st.loadingMore}>
446|                <ActivityIndicator size="small" color={colors.primary} />
447|                <Text style={st.loadingMoreText}>{t('loading')}...</Text>
448|              </View>
449|            )}
450|          </>
451|        )}
452|        <View style={{ height: 100 }} />
453|      </ScrollView>
454|      {/* Detail Modal */}
455|      {renderModal()}
456|    </View>
457|  );
458|}
459|
460|const getSt = (colors: ThemeColors) => StyleSheet.create({
461|  root: { flex: 1 },
462|  ...historyHeader(colors),
463|  list: { flex: 1, paddingHorizontal: 12 },
464|  loading: { marginTop: 80, alignItems: 'center' },
465|  loadingText: { marginTop: 12, fontSize: FONTS.sub.size, color: colors.primary },
466|  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 8 },
467|  loadingMoreText: { fontSize: FONTS.sub.size, color: colors.primary },
468|  /* Card */
469|  card: {
470|    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
471|    marginBottom: 12, borderWidth: 1, borderColor: colors.secondary,
472|    // @ts-ignore
473|    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
474|    gap: 10,
475|  },
476|  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 8 },
477|  dateItem: { flex: 1, alignItems: 'center' },
478|  dateLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 2 },
479|  dateVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
480|  dateSep: { width: 1, height: 24, backgroundColor: colors.secondary },
481|  /* Card vertical pairs — plain, no background */
482|  cardPairRow: { flexDirection: 'row', gap: 4 },
483|  cardPairCol: { flex: 1, alignItems: 'center' },
484|  cardPairItem: { alignItems: 'center', gap: 2, paddingVertical: 4 },
485|  cardPairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
486|  cardPairVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
487|  cardPairDiv: { height: 1, backgroundColor: colors.bg, width: '60%', marginVertical: 2 },
488|  tapHint: { fontSize: FONTS.micro.size, color: colors.primary, textAlign: 'center', marginTop: 2 },
489|  /* Modal */
490|  mask: {
491|    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
492|    zIndex: 200, justifyContent: 'center', alignItems: 'center',
493|  },
494|  maskBg: {
495|    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
496|    backgroundColor: withAlpha(colors.textMain, 0.4),
497|  },
498|  modal: {
499|    width: '88%', maxWidth: 380,
500|    backgroundColor: colors.surface, borderRadius: 20,
501|    overflow: 'hidden',
502|    // @ts-ignore
503|    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
504|    // @ts-ignore
505|    ...modalCardAnimation,
506|  },
507|  modalHeader: {
508|    backgroundColor: colors.primary,
509|    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
510|    paddingVertical: 12, paddingHorizontal: 18,
511|  },
512|  modalDate: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
513|  modalDateSub: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: withAlpha(colors.surface, 0.75), marginTop: 2 },
514|  modalClose: { ...modalClose, paddingLeft: 8 },
515|  /* Three vertical pairs */
516|  pairRow: {
517|    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 10,
518|    gap: 6,
519|  },
520|  pairCol: {
521|    flex: 1, alignItems: 'center',
522|    backgroundColor: colors.bg, borderRadius: 12,
523|    paddingVertical: 10, paddingHorizontal: 4,
524|  },
525|  pairItem: { alignItems: 'center', gap: 4, paddingVertical: 6 },
526|  pairLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
527|  pairVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
528|  pairDivider: { height: 1, backgroundColor: colors.secondary, width: '70%' },
529|  /* Channel section */
530|  chanSection: {
531|    marginHorizontal: 14, marginBottom: 18, marginTop: 4,
532|    borderTopWidth: 1, borderTopColor: colors.bg,
533|    paddingTop: 12,
534|  },
535|  chanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 4 },
536|  chanLabel: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight },
537|  chanVal: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
538|  /* Empty state */
539|
540|  /* Filter — ultra-minimal */
541|  filterBtnText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
542|  filterBtnTextActive: { color: colors.surface },
543|  filterPanel: {
544|    backgroundColor: colors.surface, borderRadius: 10,
545|    borderWidth: 1, borderColor: colors.secondary,
546|    overflow: 'hidden',
547|  },
548|  filterContent: {
549|    padding: 12, gap: 8,
550|  },
551|  filterField: {
552|    flexDirection: 'row', alignItems: 'center', gap: 8,
553|  },
554|  filterLabel: {
555|    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub,
556|    width: 64, flexShrink: 0,
557|  },
558|  filterDateRange: {
559|    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
560|  },
561|  filterDateInput: {
562|    flex: 1,
563|    height: 34,
564|    paddingHorizontal: 8,
565|    backgroundColor: colors.surface,
566|    borderRadius: 6,
567|    borderWidth: 1, borderColor: colors.secondary,
568|    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
569|    fontFamily: 'inherit',
570|    outline: 'none',
571|  },
572|  filterDateWrap: {
573|    flex: 1, height: 34, position: 'relative' as any,
574|    backgroundColor: colors.surface, borderRadius: 6,
575|    borderWidth: 1, borderColor: colors.secondary,
576|    justifyContent: 'center', paddingHorizontal: 8,
577|  },
578|  filterDateText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
579|  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
580|  filterDateHidden: {
581|    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
582|    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
583|  },
584|  filterInput: {
585|    height: 34,
586|    paddingHorizontal: 8,
587|    backgroundColor: colors.surface,
588|    borderRadius: 6,
589|    borderWidth: 1, borderColor: colors.secondary,
590|    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
591|  },
592|  filterSelectWrap: {
593|    flex: 1, position: 'relative',
594|  },
595|  filterSelect: {
596|    width: '100%',
597|    height: 34,
598|    paddingLeft: 8,
599|    paddingRight: 30,
600|    backgroundColor: colors.surface,
601|    borderRadius: 6,
602|    borderWidth: 1, borderColor: colors.secondary,
603|    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub,
604|    fontFamily: 'inherit',
605|    outline: 'none',
606|    WebkitAppearance: 'none',
607|    MozAppearance: 'none',
608|    appearance: 'none',
609|    cursor: 'pointer',
610|  },
611|  filterSelectArrow: {
612|    position: 'absolute',
613|    right: 8, top: 9,
614|    fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight,
615|    pointerEvents: 'none',
616|  },
617|  filterActions: {
618|    flexDirection: 'row', gap: 8, paddingTop: 6,
619|  },
620|  filterResetBtn: {
621|    flex: 1, height: 34, borderRadius: 8,
622|    justifyContent: 'center', alignItems: 'center',
623|    backgroundColor: colors.secondary,
624|  },
625|  filterResetBtnText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
626|  filterApplyBtn: {
627|    flex: 1, height: 34, borderRadius: 8,
628|    justifyContent: 'center', alignItems: 'center',
629|    backgroundColor: colors.primary,
630|  },
631|  filterApplyBtnDisabled: {
632|    backgroundColor: colors.secondary,
633|  },
634|  filterApplyBtnText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.surface },
635|  filterApplyBtnTextDisabled: {
636|    color: colors.textSub,
637|  },
638|  /* Reconciler in card */
639|  reconByRow: { alignItems: 'center', paddingBottom: 2 },
640|  reconByText: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
641|} as any);
642|