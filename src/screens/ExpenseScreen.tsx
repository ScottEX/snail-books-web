import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Animated,
} from 'react-native';
import { t } from '../i18n';
import { api } from '../api/client';

/* ── helpers ── */
const fmt = (n: number) => '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => parseFloat(s) || 0;

/* ═══════════════════════════════════════════════════════════
   NumberTicker — 数字从 0 平滑滚动到目标值
   ═══════════════════════════════════════════════════════════ */
function NumberTicker({ value, duration = 500, style }: {
  value: number; duration?: number; style?: any;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  // Pick formatter: if value has decimals use fmt, else fmtInt + ¥
  const text = Number.isInteger(value) && Number.isInteger(display)
    ? '¥' + fmtInt(Math.round(display))
    : fmt(display);

  return <Text style={style}>{text}</Text>;
}

/* ═══════════════════════════════════════════════════════════
   FadeInView — 卡片平滑淡入提升 (300ms)
   ═══════════════════════════════════════════════════════════ */
function FadeInView({ children, style }: {
  children: React.ReactNode; style?: any;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════
   InputWithFocus — 聚焦时边框过渡到品牌红
   ═══════════════════════════════════════════════════════════ */
function InputWithFocus({ style, inputStyle, ...props }: any) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      onFocus={(e: any) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e: any) => { setFocused(false); props.onBlur?.(e); }}
      style={[
        inputStyle,
        {
          borderColor: focused ? '#8B1E22' : '#E5E7EB',
          // @ts-ignore — web-only transition
          transition: 'border-color 200ms ease',
        },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   EXPENSE SCREEN
   ═══════════════════════════════════════════════════════════ */
export default function ExpenseScreen() {
  const [activeTab, setActiveTab] = useState(0); // 0=对账, 1=营业, 2=支出
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);

  // Inject scroll-snap CSS + native scroll listener (RN Web onScroll unreliable with CSS snap)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-testid="snap-scroll"] { scroll-snap-type: x mandatory; }
      [data-testid="snap-card"] { scroll-snap-align: start; scroll-snap-stop: always; }
    `;
    document.head.appendChild(style);

    // Native DOM scroll listener — more reliable than RN synthetic onScroll with CSS snap
    const el = document.querySelector('[data-testid="snap-scroll"]') as HTMLElement | null;
    scrollElRef.current = el;
    const onNativeScroll = () => {
      if (!scrollElRef.current) return;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        const idx = Math.round(scrollElRef.current!.scrollLeft / 310);
        setActiveTab(Math.min(2, Math.max(0, idx)));
      }, 150);
    };
    el?.addEventListener('scroll', onNativeScroll, { passive: true });

    return () => {
      document.head.removeChild(style);
      el?.removeEventListener('scroll', onNativeScroll);
    };
  }, []);

  /* ── 模块一：对账 ── */
  const [recDate, setRecDate] = useState(todayStr());
  const [cardBalance, setCardBalance] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [dineIn, setDineIn] = useState('');
  const [meituan, setMeituan] = useState('');
  const [eleme, setEleme] = useState('');
  const [tuan, setTuan] = useState('');
  const [jd, setJd] = useState('');

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('expense-rec') || '{}');
      const d = saved[recDate];
      setCardBalance(d?.card || '');
      setCashBalance(d?.cash || '');
      setDineIn(d?.dineIn || '');
      setMeituan(d?.meituan || '');
      setEleme(d?.eleme || '');
      setTuan(d?.tuan || '');
      setJd(d?.jd || '');
    } catch {}
  }, [recDate]);

  const saveRec = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('expense-rec') || '{}');
      saved[recDate] = { card: cardBalance, cash: cashBalance, dineIn, meituan, eleme, tuan, jd };
      localStorage.setItem('expense-rec', JSON.stringify(saved));
    } catch {}
  }, [recDate, cardBalance, cashBalance, dineIn, meituan, eleme, tuan, jd]);

  const channelTotal = toNum(dineIn) + toNum(meituan) + toNum(eleme) + toNum(tuan) + toNum(jd);
  const realTotal = toNum(cardBalance) + toNum(cashBalance);
  const diff = realTotal - channelTotal;

  /* ── 模块二：营业额 ── */
  const [revenueData, setRevenueData] = useState({ todayRevenue: 0, todayActual: 0 });
  const [revenueList, setRevenueList] = useState<any[]>([]);

  const loadRevenue = async () => {
    try {
      const s = await api.getSummary();
      setRevenueData({ todayRevenue: s.income || 0, todayActual: s.income || 0 });
      const tx = await api.getTransactions(1);
      setRevenueList((tx.transactions || []).filter((t: any) => t.type === 'income').slice(0, 20));
    } catch {}
  };
  useEffect(() => { loadRevenue(); }, []);

  /* ── 模块三：支出 ── */
  const [expDate, setExpDate] = useState(todayStr());
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);

  const loadExpenses = async () => {
    try {
      const tx = await api.getTransactions(1);
      setExpenses((tx.transactions || []).filter((t: any) => t.type === 'expense'));
    } catch {}
  };
  useEffect(() => { loadExpenses(); }, []);

  const handleAddExpense = async () => {
    if (!expAmount) return;
    setLoadingExp(true);
    try {
      await api.createTransaction({
        type: 'expense',
        amount: parseFloat(expAmount),
        category: '📝 其他',
        account: '现金',
        note: expNote,
      });
      setExpAmount('');
      setExpNote('');
      await loadExpenses();
    } catch {}
    setLoadingExp(false);
  };

  /* ── 卡片摘要数据 ── */
  const tabCards = [
    { color: '#8B1E22', title: t('tabRecon'), stat: diff, statFmt: fmt(diff), statColor: diff >= 0 ? '#059669' : '#DC2626', prefix: diff >= 0 ? '+' : '' },
    { color: '#059669', title: t('tabRevenue'), stat: revenueData.todayRevenue, statFmt: fmt(revenueData.todayRevenue), statColor: '#1A1A1A', prefix: '' },
    { color: '#DC2626', title: t('tabExpense'), stat: expenses.length, statFmt: fmtInt(expenses.length), statColor: '#1A1A1A', prefix: '' },
  ];

  /* ── Render ── */
  return (
    <View style={st.root}>
      {/* ══════ 卡片式Tab ══════ */}
      <View style={st.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          testID="snap-scroll"
          contentContainerStyle={st.tabScroll}>
          {tabCards.map((tab, i) => {
            const active = activeTab === i;
            return (
              <TouchableOpacity
                key={i}
                testID="snap-card"
                style={[st.tabCard, active && st.tabCardActive]}
                onPress={() => setActiveTab(i)}
                activeOpacity={0.7}
              >
                <View style={st.tabInner}>
                  <View style={{ gap: 4 }}>
                    <Text style={[st.tabTitle, active && st.tabTitleActive]}>
                      {tab.title}
                    </Text>
                    <Text style={st.tabStat}>
                      {tab.prefix}{tab.statFmt}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════ 内容区（FadeIn 切换） ══════ */}
      <ScrollView style={st.contentScroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={st.contentInner}>

        {/* ── 模块一：每日对账 ── */}
        {activeTab === 0 && (
        <FadeInView style={st.moduleWrap}>
          <View style={st.card}>
            {/* 日期行 */}
            <View style={st.dateRow}>
              <Text style={st.sectionLabel}>{t('dailyReconciliation')}</Text>
              <input
                type="date"
                value={recDate}
                onChange={(e: any) => setRecDate(e.target.value)}
                style={st.dateInput as any}
              />
            </View>

            {/* 实盘录入 */}
            <Text style={st.subLabel}>{t('physicalCount')}</Text>
            <View style={st.row2}>
              <View style={st.inputGroup}>
                <Text style={st.inputLabel}>{t('cardBalance')}</Text>
                <InputWithFocus inputStyle={st.input}
                  value={cardBalance} onChangeText={setCardBalance}
                  onBlur={saveRec} keyboardType="decimal-pad"
                  placeholder="0" placeholderTextColor="#D1D5DB" />
              </View>
              <View style={st.inputGroup}>
                <Text style={st.inputLabel}>{t('cashBalance')}</Text>
                <InputWithFocus inputStyle={st.input}
                  value={cashBalance} onChangeText={setCashBalance}
                  onBlur={saveRec} keyboardType="decimal-pad"
                  placeholder="0" placeholderTextColor="#D1D5DB" />
              </View>
            </View>

            {/* 渠道未到账 */}
            <Text style={st.subLabel}>{t('channelPending')}</Text>
            <View style={st.channelGrid}>
              {([
                [dineIn, setDineIn, t('dineIn')],
                [meituan, setMeituan, t('meituan')],
                [eleme, setEleme, t('eleme')],
                [tuan, setTuan, t('tuan')],
                [jd, setJd, t('jd')],
              ] as const).map(([val, setter, label]: any, i: number) => (
                <TouchableOpacity style={st.channelChip} key={i} activeOpacity={1}>
                  <Text style={st.chipLabel}>{label}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={val} onChangeText={setter}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>

            {/* 渠道汇总 */}
            <View style={st.sumRow}>
              <Text style={st.sumLabel}>{t('channelTotal')}</Text>
              <NumberTicker value={channelTotal} style={st.sumVal} />
            </View>

            {/* 核算看板 */}
            <View style={st.resultBar}>
              <View style={st.resultItem}>
                <Text style={st.resultLabel}>{t('bookBalance')}</Text>
                <NumberTicker value={realTotal} style={st.resultVal} duration={400} />
              </View>
              <View style={st.resultDivider} />
              <View style={st.resultItem}>
                <Text style={st.resultLabel}>{t('reconDiff')}</Text>
                <NumberTicker value={diff} style={[
                  st.resultDiff,
                  { color: diff >= 0 ? '#059669' : '#DC2626' },
                ]} />
              </View>
            </View>
          </View>
        </FadeInView>
        )}

        {/* ── 模块二：营业额追踪 ── */}
        {activeTab === 1 && (
        <FadeInView style={st.moduleWrap}>
          <View style={st.card}>
            {/* KPI 卡片 */}
            <View style={st.kpiRow}>
              <View style={st.kpiCard}>
                <Text style={st.kpiLabel}>{t('revenue')}</Text>
                <NumberTicker value={revenueData.todayRevenue} style={st.kpiVal} />
              </View>
              <View style={st.kpiCard}>
                <Text style={st.kpiLabel}>{t('actualRevenue')}</Text>
                <NumberTicker value={revenueData.todayActual} style={st.kpiVal} />
              </View>
            </View>

            {/* 明细表 */}
            <Text style={st.subLabel}>{t('revenueDetails')}</Text>
            {revenueList.length === 0 ? (
              <Text style={st.empty}>{t('noData')}</Text>
            ) : (
              <View style={st.tableWrap}>
                <View style={[st.tableRow, st.tableHead]}>
                  <Text style={[st.td, st.tdDate]}>{t('date')}</Text>
                  <Text style={[st.td, st.tdCat]}>{t('category2')}</Text>
                  <Text style={[st.td, st.tdAmt]}>{t('amount')}</Text>
                </View>
                {revenueList.map((r: any, i: number) => (
                  <View style={st.tableRow} key={i}>
                    <Text style={[st.td, st.tdDate]}>{(r.created_at || '').slice(0, 10)}</Text>
                    <Text style={[st.td, st.tdCat]}>{r.category}</Text>
                    <Text style={[st.td, st.tdAmt, { color: '#059669' }]}>+{fmt(r.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </FadeInView>
        )}

        {/* ── 模块三：支出明细 ── */}
        {activeTab === 2 && (
        <FadeInView style={st.moduleWrap}>
          <View style={st.card}>
            {/* 录入台 */}
            <View style={st.expForm}>
              <View style={st.expFormRow}>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e: any) => setExpDate(e.target.value)}
                  style={{ ...st.dateInput, flex: 1, marginRight: 8 } as any}
                />
                <View style={{ flex: 1 }}>
                  <InputWithFocus inputStyle={st.input}
                    value={expAmount} onChangeText={setExpAmount}
                    keyboardType="decimal-pad" placeholder={t('amount')}
                    placeholderTextColor="#D1D5DB" />
                </View>
              </View>
              <InputWithFocus inputStyle={st.input}
                value={expNote} onChangeText={setExpNote}
                placeholder={t('expenseNote')} placeholderTextColor="#D1D5DB" />
              <TouchableOpacity
                style={[st.expBtn, (!expAmount || loadingExp) && st.expBtnDisabled]}
                onPress={handleAddExpense}
                disabled={!expAmount || loadingExp}
                activeOpacity={0.8}
              >
                <Text style={st.expBtnText}>
                  {loadingExp ? '...' : t('confirmRecord')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 支出流水 */}
            <Text style={st.subLabel}>{t('expenseLedger')}</Text>
            {expenses.length === 0 ? (
              <Text style={st.empty}>{t('noExpenseRecords')}</Text>
            ) : (
              expenses.slice(0, 20).map((ex: any, i: number) => (
                <View style={st.expRow} key={i}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.expNote}>{ex.note || t('noNote')}</Text>
                    <Text style={st.expDateText}>{(ex.created_at || '').slice(0, 10)}</Text>
                  </View>
                  <Text style={st.expAmt}>-{fmt(ex.amount)}</Text>
                </View>
              ))
            )}
          </View>
        </FadeInView>
        )}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════ STYLES ═══════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },

  /* ── Tab Bar ── */
  tabBar: {
    paddingTop: 12, paddingBottom: 8,
  },
  tabScroll: {
    paddingHorizontal: 18, gap: 14,
  },
  tabCard: {
    width: 296, height: 120,
    // @ts-ignore — gradient: 青(#00A8AA) → 过渡灰(#A8B5A0) → 黄(#F0F600)
    backgroundImage: 'linear-gradient(to bottom, rgba(0,168,170,0.55), rgba(168,181,160,0.55), rgba(240,246,0,0.55))',
    borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.40)',
    paddingHorizontal: 24, paddingVertical: 20,
    justifyContent: 'flex-start',
    // @ts-ignore — CSS scroll-snap
    scrollSnapAlign: 'start',
    // @ts-ignore
    scrollSnapStop: 'always',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    // @ts-ignore — glassmorphism
    backdropFilter: 'blur(20px) saturate(180%)',
    // @ts-ignore
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  },
  tabCardActive: {
    // @ts-ignore — 激活态渐变更饱满
    backgroundImage: 'linear-gradient(to bottom, rgba(0,168,170,0.85), rgba(168,181,160,0.85), rgba(240,246,0,0.85))',
    borderColor: 'rgba(255,255,255,0.55)',
    // @ts-ignore
    boxShadow: '0 4px 14px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
  },
  tabInner: {
    alignItems: 'flex-start', gap: 8,
  },
  tabTitle: {
    fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
    fontFamily: 'SF Pro Display, Helvetica Neue, Roboto, sans-serif',
    // @ts-ignore
    textShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  tabTitleActive: {
    color: '#FFFFFF', fontWeight: '700',
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  tabStat: {
    fontSize: 28, fontWeight: '600', letterSpacing: -0.5,
    fontFamily: 'SF Pro Display, Helvetica Neue, Roboto, sans-serif',
    color: '#FFFFFF',
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },

  /* ── Content ── */
  contentScroll: { flex: 1 },
  contentInner: {
    paddingHorizontal: 18, paddingBottom: 100, gap: 0,
  },
  moduleWrap: {
    width: '100%',
  },

  /* ── Content Card (glass) ── */
  card: {
    borderRadius: 14,
    padding: 18,
    gap: 14,
    backgroundColor: '#FAF7F2',
    borderWidth: 0.5, borderColor: '#E8E4DD',
    // @ts-ignore
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },

  /* ── Date ── */
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateInput: {
    fontSize: 13, color: '#6B7280',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: '#F9FAFB', fontFamily: undefined,
    // @ts-ignore
    transition: 'border-color 200ms ease',
  } as any,

  /* ── Labels ── */
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  subLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },

  /* ── Inputs ── */
  row2: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12,
    fontSize: 15, fontWeight: '600', color: '#1A1A1A', fontFamily: undefined,
  },

  /* ── Channel grid ── */
  channelGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  channelChip: {
    flex: 1, minWidth: 60, maxWidth: 80,
    backgroundColor: '#F9FAFB',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB',
    paddingVertical: 6, paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  chipLabel: {
    fontSize: 9, color: '#9CA3AF', fontWeight: '600',
  },
  chipInput: {
    fontSize: 14, fontWeight: '700', color: '#1A1A1A',
    textAlign: 'center', paddingVertical: 2,
    fontFamily: undefined,
    width: '100%',
    borderWidth: 0, backgroundColor: 'transparent',
  },

  /* ── Sum row ── */
  sumRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  sumLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  sumVal: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },

  /* ── Result bar ── */
  resultBar: {
    flexDirection: 'row', backgroundColor: '#F9FAFB',
    borderRadius: 14, padding: 16,
    alignItems: 'center',
  },
  resultItem: { flex: 1, alignItems: 'center' },
  resultDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  resultLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  resultVal: { fontSize: 17, fontWeight: '700', color: '#374151' },
  resultDiff: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  /* ── KPI ── */
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#F9FAFB',
    borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  kpiLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  kpiVal: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },

  /* ── Table ── */
  tableWrap: {
    borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 12, overflow: 'hidden',
  },
  tableHead: { backgroundColor: '#F9FAFB' },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EBEBEB',
  },
  td: { paddingVertical: 10, paddingHorizontal: 10, fontSize: 12, color: '#374151' },
  tdDate: { width: 90, color: '#6B7280', fontSize: 11 },
  tdCat: { flex: 1 },
  tdAmt: { width: 100, textAlign: 'right', fontWeight: '600' },

  /* ── Expense form ── */
  expForm: { gap: 10 },
  expFormRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  expBtn: {
    backgroundColor: '#8B1E22', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center',
  },
  expBtnDisabled: { backgroundColor: '#E5E7EB' },
  expBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ── Expense list ── */
  expRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EBEBEB',
  },
  expNote: { fontSize: 13, color: '#374151', fontWeight: '500' },
  expDateText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  expAmt: { fontSize: 15, fontWeight: '700', color: '#DC2626' },

  /* ── Empty ── */
  empty: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24,
  },
});
