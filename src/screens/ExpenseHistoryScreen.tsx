1|import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
2|import {
3|  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Animated
4|} from 'react-native';
5|import Svg, { Path, Circle } from 'react-native-svg';
6|import { t, getLang } from '../i18n';
7|import { trCategory, trPayment } from '../i18nHelpers';
8|import { api } from '../api/client';
9|import Toast from "../components/Toast";
10|import EmptyState from "../components/EmptyState";
11|import ImagePreview from '../components/ImagePreview';
12|import { useTheme, withAlpha, ThemeColors } from '../theme';
13|import { useSwipeBack } from '../hooks/useSwipeBack';
14|import { FONTS } from '../theme';
15|import { modalClose, historyHeader } from '../sharedStyles';
16|import { getCurrentUser } from '../utils/storage';
17|import DateErrorHint from '../components/DateErrorHint';
18|import BackArrow from '../components/icons/BackArrow';
19|
20|const PAGE_SIZE = 10;
21|
22|// Date helpers replaced by useServerDate() hook
23|const isFuture = (d: string) => d > sd.today;
24|// Strict calendar months between two ISO dates (YYYY-MM-DD)
25|function monthsBetween(from: string, to: string): number {
26|  const [fy, fm, fd] = from.split('-').map(Number);
27|  const [ty, tm, td] = to.split('-').map(Number);
28|  let m = (ty - fy) * 12 + (tm - fm);
29|  if (td < fd) m -= 1;
30|  return m;
31|}
32|
33|function ExpenseEmptyIcon({ color }: { color: string }) {
34|  return (
35|    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
36|      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
37|      <Path d="M14 2v6h6" />
38|      <Circle cx="10" cy="12" r="3" />
39|      <Path d="M8 12h4" />
40|      <Path d="M9 17h6" />
41|      <Path d="M9 20h4" />
42|    </Svg>
43|  );
44|}
45|
46|export default function ExpenseHistoryScreen({ onBack, refreshKey, onExpDetail }: { onBack: () => void; refreshKey?: number; onExpDetail?: (e: any) => void }) {
47|  const [records, setRecords] = useState<any[]>([]);
48|  const swipeBack = useSwipeBack(onBack);
49|  const [page, setPage] = useState(1);
50|  const [total, setTotal] = useState(0);
51|  const [totalAll, setTotalAll] = useState(0);
52|  const [hasMore, setHasMore] = useState(false);
53|  const [loading, setLoading] = useState(false);
54|  const [toast, setToast] = useState('');
55|  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
56|
57|  // Uncontrolled date refs — React Native Web <input type="date"> crashes with controlled value={state}
58|  const filDateFromRef = useRef<HTMLInputElement>(null);
59|  const filDateToRef = useRef<HTMLInputElement>(null);
60|  const [showFilter, setShowFilter] = useState(false);
61|  const filterAnim = useRef(new Animated.Value(0)).current;
62|  const [filDateFrom, setFilDateFrom] = useState('');
63|  useEffect(() => { if (sd.ready && filDateFrom === '') setFilDateFrom(sd.offset(-30)); }, [sd.ready, sd.today, filDateFrom]);
64|  const [filDateTo, setFilDateTo] = useState('');
65|  useEffect(() => { if (sd.ready && filDateTo === '') setFilDateTo(sd.today); }, [sd.ready, sd.today, filDateTo]);
66|  useEffect(() => { if (filDateFromRef.current) filDateFromRef.current.value = filDateFrom; }, [filDateFrom]);
67|  useEffect(() => { if (filDateToRef.current) filDateToRef.current.value = filDateTo; }, [filDateTo]);
68|  const [filCategories, setFilCategories] = useState<string[]>([]);
69|  // Track active filters (snapshot at last apply) — compare strings to avoid object deps
70|  const [appliedFrom, setAppliedFrom] = useState('');
71|  useEffect(() => { if (sd.ready && appliedFrom === '') setAppliedFrom(sd.offset(-30)); }, [sd.ready, sd.today, appliedFrom]);
72|  const [appliedTo, setAppliedTo] = useState('');
73|  useEffect(() => { if (sd.ready && appliedTo === '') setAppliedTo(sd.today); }, [sd.ready, sd.today, appliedTo]);
74|  const [appliedCats, setAppliedCats] = useState('');
75|  const loadingRef = useRef(false);
76|  const pageRef = useRef(1);
77|  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
78|  const [filterDateError, setFilterDateError] = useState(0);
79|  const [filDateFromKey, setFilDateFromKey] = useState(0);
80|  const [filDateToKey, setFilDateToKey] = useState(0);
81|
82|  const { colors, isDark } = useTheme();
83|    const sd = useServerDate();
84|  const st = useMemo(() => getSt(colors), [colors]);
85|
86|  // Build filter params from applied values
87|  const getFilterParams = useCallback((): Record<string, string> => {
88|    const f: Record<string, string> = { type: 'expense' };
89|    if (appliedFrom) f.date_from = appliedFrom;
90|    if (appliedTo) f.date_to = appliedTo;
91|    if (appliedCats) f.category = appliedCats;
92|    return f;
93|  }, [appliedFrom, appliedTo, appliedCats]);
94|
95|  // i18n mapping for category & payment. Helper handles both internal keys
96|  // (new data) and legacy Chinese substrings (old data, with/without emoji).
97|  const trCat = (s: string) => trCategory(s);
98|  const trPay = (s: string) => trPayment(s);
99|  const fmtExpDate = (d: string) => {
100|    const [y, m, day] = d.split('-');
101|    const l = getLang();
102|    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
103|    return `${y}年${m}月${day}日`;
104|  };
105|
106|  // Parse images field from API (stored as JSON string '["url1","url2"]')
107|  const parseImages = (raw: any): string[] => {
108|    if (!raw) return [];
109|    if (Array.isArray(raw)) return raw;
110|    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
111|  };
112|
113|  const isFuture = (d: string) => d > sd.today;
114|  useEffect(() => { if (showFilter) setFilterDateError(0); }, [showFilter]);
115|
116|  // Fetch one page from server (with current filters)
117|  const loadPage = useCallback(async (pg: number, reset: boolean) => {
118|    if (loadingRef.current) return;
119|    loadingRef.current = true;
120|    if (reset) setLoading(true);
121|    try {
122|      const tx: any = await api.getTransactions(pg, PAGE_SIZE, getFilterParams());
123|      const exps = tx.transactions || [];
124|      setRecords(prev => reset ? exps : [...prev, ...exps]);
125|      setPage(pg);
126|      pageRef.current = pg;
127|      setTotal(tx.total || 0);
128|      setTotalAll(tx.total_all ?? tx.total ?? 0);
129|      setHasMore(pg < (tx.pages || 1));
130|    } catch { setToast(t('toastLoadFailed')); }
131|    setLoading(false);
132|    loadingRef.current = false;
133|  }, [getFilterParams]);
134|
135|  // Initial load — trigger when filter params change
136|  const filterKey = `${appliedFrom}|${appliedTo}|${appliedCats}`;
137|  useEffect(() => {
138|    setRecords([]);
139|    loadPage(1, true);
140|  }, [filterKey, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
141|
142|  // Current user for displaying who filled each record
143|  const currentUser = getCurrentUser();
144|
145|  // Render a single transaction row (FlatList item) — uses thumb_images for the
146|  // 48×48 list tile (fast, ~5-10KB) and falls back to full-size images for old
147|  // data without thumb_images. Preview always opens the full-size images.
148|  const renderItem = useCallback(({ item: e, index: i }: { item: any; index: number }) => {
149|    const thumbImgs = e.thumb_images ? parseImages(e.thumb_images) : [];
150|    const displayImgs = thumbImgs.length > 0 ? thumbImgs : parseImages(e.images);
151|    const previewImgs = parseImages(e.images);
152|    return (
153|      <TouchableOpacity onPress={() => onExpDetail?.(e)} activeOpacity={0.7}>
154|        <View style={st.row}>
155|        <View style={st.rowTop}>
156|          <View style={st.badges}>
157|            <View style={st.catBadge}>
158|              <Text style={st.catBadgeText}>{trCat(e.category || '')}</Text>
159|            </View>
160|            <View style={st.payBadge}>
161|              <Text style={st.payBadgeText}>{trPay(e.account || '')}</Text>
162|            </View>
163|          </View>
164|          <Text style={st.amount}>-¥{Number(e.amount || 0).toFixed(2)}</Text>
165|        </View>
166|        {currentUser ? (
167|          <Text style={st.filledBy}>{t('filledBy')}: {currentUser}</Text>
168|        ) : null}
169|        <View style={st.rowBottom}>
170|          <Text style={st.dateText}>{fmtExpDate(e.date || (e.created_at || '').slice(0, 10))}</Text>
171|          {e.proc_batch_number ? (
172|            <Text style={st.note} numberOfLines={1}>{t('procNowBatch').replace('{n}', String(e.proc_batch_number))}</Text>
173|          ) : e.note ? (
174|            <Text style={st.note} numberOfLines={1}>{e.note}</Text>
175|          ) : (
176|            <View style={{ flex: 1 }} />
177|          )}
178|        </View>
179|        {/* Image thumbnails — lazy + async + bg placeholder so JS thread stays free for scroll */}
180|        {displayImgs.length > 0 && (
181|          <View style={st.imgThumbs}>
182|            {displayImgs.map((url: string, j: number) => (
183|              <TouchableOpacity key={j}
184|                onPress={() => setPreviewData({ images: previewImgs, idx: j })}
185|                activeOpacity={0.8}>
186|                {React.createElement('img', {
187|                  src: url,
188|                  loading: 'lazy' as any,
189|                  decoding: 'async' as any,
190|                  style: {
191|                    width: 48, height: 48, borderRadius: 6, objectFit: 'cover',
192|                    backgroundColor: colors.bg,
193|                  } as any,
194|                  alt: 'receipt',
195|                })}
196|              </TouchableOpacity>
197|            ))}
198|          </View>
199|        )}
200|      </View>
201|      </TouchableOpacity>
202|    );
203|  }, [currentUser, colors.bg, st, parseImages, trCat, trPay, fmtExpDate, t, onExpDetail]);
204|
205|  // End-of-list pagination — replaces ScrollView onScroll, debounced 150ms
206|  const onEndReached = useCallback(() => {
207|    if (loadingRef.current || !hasMore) return;
208|    if (scrollTimerRef.current) return;
209|    scrollTimerRef.current = setTimeout(() => {
210|      scrollTimerRef.current = null;
211|      loadPage(pageRef.current + 1, false);
212|    }, 150);
213|  }, [hasMore, loadPage]);
214|
215|  // Category toggle
216|  const toggleCat = (cat: string) => {
217|    setFilCategories(prev =>
218|      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
219|    );
220|  };
221|
222|  // No client-side filtering — server handles it
223|  const visible = records;
224|
225|  // Date range validity — persistent hint while invalid (matches ReconHistoryScreen)
226|  const rangeInvalid = useMemo(() =>
227|    !!(filDateFrom && filDateTo && filDateFrom > filDateTo),
228|    [filDateFrom, filDateTo]);
229|  // 24-month max-span guard (strict calendar months)
230|  const rangeTooLong = useMemo(() =>
231|    !!(filDateFrom && filDateTo && !rangeInvalid && monthsBetween(filDateFrom, filDateTo) > 24),
232|    [filDateFrom, filDateTo, rangeInvalid]);
233|
234|
235|
236|  return (
237|    <View style={st.root} {...swipeBack}>
238|      {/* Header — absolute, transparent, floats above scroll (matches ReconHistoryScreen) */}
239|      <View style={st.header}>
240|        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
241|          <View style={st.backBtn}>
242|            <BackArrow color={colors.primary} />
243|          </View>
244|        </TouchableOpacity>
245|        <Text style={st.title}>{t('expenseHistory')} ({total}/{totalAll})</Text>
246|        <TouchableOpacity style={[st.filterBtn, showFilter && st.filterBtnActive]} onPress={() => {
247|            if (!showFilter) {
248|              filterAnim.setValue(0);
249|              Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 170, friction: 26 }).start();
250|            }
251|            setShowFilter(!showFilter);
252|          }} activeOpacity={0.7}>
253|          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={showFilter ? colors.surface : colors.textSub} strokeWidth={2} strokeLinecap="round">
254|            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
255|          </Svg>
256|        </TouchableOpacity>
257|      </View>
258|
259|      {/* Filter panel */}
260|      {showFilter && (<>
261|        <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, opacity: filterAnim }}>
262|          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => {
263|            Animated.timing(filterAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShowFilter(false));
264|          }} />
265|        </Animated.View>
266|        <Animated.View style={{
267|          position: 'fixed' as any, top: 108, left: 12, right: 12, zIndex: 9999,
268|          opacity: filterAnim,
269|          transform: [
270|            { translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
271|            { scale: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
272|          ],
273|        }}>
274|        <View style={st.filterPanel}>
275|          <View style={st.filterContent}>
276|            <DateErrorHint trigger={filterDateError} message={t('errDateFuture')} color={colors.danger} />
277|            {rangeInvalid && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRange')}</Text>}
278|            {rangeTooLong && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right', marginTop: 2 }}>{t('errDateRangeTooLong')}</Text>}
279|            {/* Date range */}
280|            <View style={st.filterField}>
281|              <Text style={st.filterLabel}>{t('expenseDate')}</Text>
282|              <View style={st.filterDateRange}>
283|                <View style={st.filterDateWrap}>
284|                  {filDateFrom ? (
285|                    <Text style={st.filterDateText}>{fmtExpDate(filDateFrom)}</Text>
286|                  ) : (
287|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
288|                  )}
289|                  <input type="date" ref={filDateFromRef} defaultValue={filDateFrom} max={sd.today} key={filDateFromKey}
290|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { filDateFromRef.current!.value = filDateFrom; setFilDateFromKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateFrom(e.target.value); } }}
291|                    style={st.filterDateHidden as any} />
292|                </View>
293|                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginHorizontal: 2, transform: [{ translateY: -1 }] }}><Path d="M9 18l6-6-6-6"/></Svg>
294|                <View style={st.filterDateWrap}>
295|                  {filDateTo ? (
296|                    <Text style={st.filterDateText}>{fmtExpDate(filDateTo)}</Text>
297|                  ) : (
298|                    <Text style={st.filterDatePlaceholder}>{t('any')}</Text>
299|                  )}
300|                  <input type="date" ref={filDateToRef} defaultValue={filDateTo} max={sd.today} key={filDateToKey}
301|                    onChange={(e: any) => { if (sd.sd.isFuture(e.target.value)) { filDateToRef.current!.value = filDateTo; setFilDateToKey(k => k + 1); setFilterDateError(c => c + 1); } else { setFilDateTo(e.target.value); } }}
302|                    style={st.filterDateHidden as any} />
303|                </View>
304|              </View>
305|            </View>
306|            {/* Category chips */}
307|            <View style={st.filterField}>
308|              <Text style={st.filterLabel}>{t('filterCategory')}</Text>
309|              <View style={st.filterChipRow}>
310|                {(['日常', '房租', '薪资', '采购'] as const).map(cat => {
311|                  const active = filCategories.includes(cat);
312|                  return (
313|                    <TouchableOpacity key={cat}
314|                      style={[st.filterChip, active && st.filterChipActive]}
315|                      onPress={() => toggleCat(cat)} activeOpacity={0.7}>
316|                      <Text style={[st.filterChipText, active && st.filterChipTextActive]}>{t(cat === '日常' ? 'daily' : cat === '房租' ? 'rent' : cat === '薪资' ? 'salary' : 'goods' as any)}</Text>
317|                    </TouchableOpacity>
318|                  );
319|                })}
320|              </View>
321|            </View>
322|            {/* Actions */}
323|            <View style={st.filterActions}>
324|              <TouchableOpacity style={st.filterResetBtn} onPress={() => {
325|                const dFrom = sd.offset(-30);
326|                const dTo = sd.today;
327|                setFilDateFrom(dFrom);
328|                setFilDateTo(dTo);
329|                setFilCategories([]);
330|                setAppliedFrom(dFrom);
331|                setAppliedTo(dTo);
332|                setAppliedCats('');
333|              }} activeOpacity={0.7}>
334|                <Text style={st.filterResetBtnText}>{t('reset')}</Text>
335|              </TouchableOpacity>
336|              <TouchableOpacity
337|                style={[st.filterApplyBtn, (rangeInvalid || rangeTooLong) && st.filterApplyBtnDisabled]}
338|                disabled={rangeInvalid || rangeTooLong}
339|                onPress={() => {
340|                  setAppliedFrom(filDateFrom);
341|                  setAppliedTo(filDateTo);
342|                  setAppliedCats(filCategories.join(','));
343|                  setShowFilter(false);
344|                }} activeOpacity={0.8}>
345|                <Text style={[st.filterApplyBtnText, (rangeInvalid || rangeTooLong) && st.filterApplyBtnTextDisabled]}>{t('apply')}</Text>
346|              </TouchableOpacity>
347|            </View>
348|          </View>
349|        </View>
350|                </Animated.View>
351|      </>)}
352|
353|        {/* List — FlatList virtualises rows so off-screen items don't block scroll */}
354|      <FlatList
355|        testID="exp-scroll"
356|        style={st.list}
357|        data={visible}
358|        keyExtractor={(e: any, i: number) => e.id != null ? `tx-${e.id}` : `tx-${i}`}
359|        renderItem={renderItem}
360|        onEndReached={onEndReached}
361|        onEndReachedThreshold={0.4}
362|        showsVerticalScrollIndicator={false}
363|        contentContainerStyle={{ paddingTop: showFilter ? 246 : 112, paddingHorizontal: 16, paddingBottom: 100 }}
364|        ListEmptyComponent={!loading ? (
365|          <EmptyState
366|            icon={<ExpenseEmptyIcon color={colors.textSub} />}
367|            title={t('noRecords')}
368|            hint={t('emptyExpenseHint')}
369|          />
370|        ) : null}
371|        ListFooterComponent={loading ? (
372|          <View style={st.loading}>
373|            <ActivityIndicator size="small" color={colors.primary} />
374|            <Text style={st.loadingText}>...</Text>
375|          </View>
376|        ) : null}
377|      />
378|
379|      {previewData && (
380|        <ImagePreview
381|          images={previewData.images}
382|          initialIdx={previewData.idx}
383|          visible={true}
384|          onClose={() => setPreviewData(null)}
385|        />
386|      )}
387|
388|      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
389|    </View>
390|  );
391|}
392|
393|const getSt = (colors: ThemeColors): any => StyleSheet.create({
394|  /* Root — flex: 1, no background (page bg from parent) */
395|  root: { flex: 1 },
396|  ...historyHeader(colors),
397|  /* List — scrolls under absolute header (matches ReconHistoryScreen list) */
398|  list: { flex: 1 },
399|  /* Row */
400|  row: {
401|    backgroundColor: colors.surface, borderRadius: 12,
402|    paddingVertical: 14, paddingHorizontal: 14,
403|    marginBottom: 8,
404|    borderWidth: 1, borderColor: colors.secondary,
405|    // @ts-ignore
406|    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
407|    gap: 6,
408|  },
409|  rowTop: {
410|    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
411|  },
412|  badges: {
413|    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1,
414|  },
415|  catBadge: {
416|    backgroundColor: withAlpha(colors.warning, 0.1), borderRadius: 4,
417|    paddingHorizontal: 8, paddingVertical: 3,
418|  },
419|  catBadgeText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary },
420|  payBadge: {
421|    backgroundColor: colors.bg, borderRadius: 4,
422|    paddingHorizontal: 8, paddingVertical: 3,
423|  },
424|  payBadgeText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
425|  amount: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.danger },
426|  filledBy: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
427|  imgThumbs: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
428|  rowBottom: {
429|    flexDirection: 'row', alignItems: 'center', gap: 16,
430|  },
431|  dateText: { fontSize: FONTS.sub.size, color: colors.textSub, flexShrink: 0 },
432|  note: { fontSize: FONTS.sub.size, color: colors.textSub, flex: 1, textAlign: 'right', overflow: 'hidden' },
433|
434|  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
435|  loadingText: { fontSize: FONTS.sub.size, color: colors.primary },
436|  /* Preview overlay */
437|
438|  /* Filter panel — matches ReconHistoryScreen */
439|  filterBtnTextActive: { color: colors.surface },
440|  filterPanel: {
441|    backgroundColor: colors.surface, borderRadius: 10,
442|    borderWidth: 1, borderColor: colors.secondary,
443|    overflow: 'hidden',
444|  },
445|  filterContent: { padding: 12, gap: 8 },
446|  filterField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
447|  filterLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub, width: 64, flexShrink: 0 },
448|  filterDateRange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
449|  // @ts-ignore outline is web-only CSS, not in RN types
450|  filterDateInput: {
451|    flex: 1, height: 34, paddingHorizontal: 8,
452|    backgroundColor: colors.surface, borderRadius: 6,
453|    borderWidth: 1, borderColor: colors.secondary,
454|    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
455|    fontFamily: 'inherit', outline: 'none',
456|  },
457|  filterDateWrap: {
458|    flex: 1, height: 34, position: 'relative' as any,
459|    backgroundColor: colors.surface, borderRadius: 6,
460|    borderWidth: 1, borderColor: colors.secondary,
461|    justifyContent: 'center', paddingHorizontal: 8,
462|  },
463|  filterDateText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
464|  filterDatePlaceholder: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
465|  filterDateHidden: {
466|    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
467|    opacity: 0.01, cursor: 'pointer', width: '100%', height: '100%',
468|  },
469|  filterChipRow: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
470|  filterChip: {
471|    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
472|    backgroundColor: colors.bg,
473|  },
474|  filterChipActive: { backgroundColor: colors.primary },
475|  filterChipText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
476|  filterChipTextActive: { color: colors.surface },
477|  filterActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
478|  filterResetBtn: {
479|    flex: 1, alignItems: 'center', paddingVertical: 8,
480|    backgroundColor: colors.secondary, borderRadius: 8,
481|  },
482|  filterResetBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
483|  filterApplyBtn: {
484|    flex: 1, alignItems: 'center', paddingVertical: 8,
485|    backgroundColor: colors.primary, borderRadius: 8,
486|  },
487|  filterApplyBtnDisabled: {
488|    backgroundColor: colors.secondary,
489|  },
490|  filterApplyBtnText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
491|  filterApplyBtnTextDisabled: {
492|    color: colors.textSub,
493|  },
494|} as any);