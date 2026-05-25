import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Animated,
} from 'react-native';
import { t, getLang } from '../i18n';
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

  // Auto-scroll to active card when activeTab changes (click or swipe)
  useEffect(() => {
    const el = document.querySelector('[data-testid="snap-scroll"]') as HTMLElement;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = activeTab * 310;
      });
    }
  }, [activeTab]);

  /* ── 模块一：对账 ── */
  const [recDate, setRecDate] = useState(todayStr());
  const [cardBalance, setCardBalance] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [dineIn, setDineIn] = useState('');
  const [meituan, setMeituan] = useState('');
  const [flashSale, setFlashSale] = useState('');
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
      setFlashSale(d?.flashSale || '');
      setTuan(d?.tuan || '');
      setJd(d?.jd || '');
    } catch {}
  }, [recDate]);

  const saveRec = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('expense-rec') || '{}');
      saved[recDate] = { card: cardBalance, cash: cashBalance, dineIn, meituan, flashSale, tuan, jd };
      localStorage.setItem('expense-rec', JSON.stringify(saved));
    } catch {}
  }, [recDate, cardBalance, cashBalance, dineIn, meituan, flashSale, tuan, jd]);

  const channelTotal = toNum(dineIn) + toNum(meituan) + toNum(flashSale) + toNum(tuan) + toNum(jd);
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
                  <Text style={[st.tabTitle, active && st.tabTitleActive]}>
                    {tab.title}
                  </Text>
                  {i === 0 && (
                    <View style={st.cardFields}>
                      <View style={st.cardFieldRow}>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>在途资金</Text>
                          <Text style={st.cardFieldVal}>¥{fmtInt(channelTotal)}</Text>
                        </View>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>当前结余</Text>
                          <Text style={st.cardFieldVal}>¥{fmtInt(realTotal)}</Text>
                        </View>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>账面差额</Text>
                          <Text style={[st.cardFieldVal, { color: diff >= 0 ? '#E6F7EE' : '#FDE8E8' }]}>{diff >= 0 ? '+' : ''}¥{fmtInt(Math.abs(diff))}</Text>
                        </View>
                      </View>
                    </View>
                  )}
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
              <Text style={[st.sectionLabel, { fontSize: 14 }]}>{t('billDate')}</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative' }}
                activeOpacity={1}
              >
                <Text style={st.dateText}>
                  {(() => {
                    const d = new Date(recDate + 'T00:00:00');
                    const l = getLang();
                    if (l.startsWith('en')) {
                      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    }
                    if (l === 'zh-Hant' || l === 'zh-TW') {
                      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                    }
                    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                  })()}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#9CA3AF' }}>›</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: recDate,
                  onChange: (e: any) => setRecDate(e.target.value),
                  style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: 14 },
                })}
              </TouchableOpacity>
            </View>

            <View style={st.row2}>
              <View style={st.inputGroup}>
                <Text style={st.inputLabel}>{t('cardBalance')} 💳</Text>
                <InputWithFocus inputStyle={st.input}
                  value={cardBalance} onChangeText={setCardBalance}
                  onBlur={saveRec} keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor="#D1D5DB" />
              </View>
              <View style={st.inputGroup}>
                <Text style={st.inputLabel}>{t('cashBalance')} 💴</Text>
                <InputWithFocus inputStyle={st.input}
                  value={cashBalance} onChangeText={setCashBalance}
                  onBlur={saveRec} keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor="#D1D5DB" />
              </View>
            </View>

            {/* 渠道未到账 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[st.subLabel, { fontSize: 12, fontWeight: '800', color: '#1A1A1A' }]}>{t('channelPending')}</Text>
              <NumberTicker value={channelTotal} style={{ fontSize: 14, fontWeight: '700', color: '#C93638' }} />
            </View>
            <View style={st.channelGrid}>
              {/* Row 1: 堂食 + 美团 + 闪购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('dineIn')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={dineIn} onChangeText={setDineIn}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('meituan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={meituan} onChangeText={setMeituan}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('flashSale')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={flashSale} onChangeText={setFlashSale}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
              </View>
              {/* Row 2: 京东 + 团购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('jd')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={jd} onChangeText={setJd}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('tuan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={tuan} onChangeText={setTuan}
                    onBlur={saveRec} keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 对账完成 */}
            <TouchableOpacity style={st.reconBtn} onPress={() => {}} activeOpacity={0.8}>
              <Text style={st.reconBtnText}>{t('reconComplete')}</Text>
            </TouchableOpacity>
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
    // @ts-ignore — 确保容器透明，让底层背景透出
    backgroundColor: 'transparent',
  },
  tabScroll: {
    paddingHorizontal: 18, gap: 14,
    // @ts-ignore — 确保 ScrollView 内容区透明
    backgroundColor: 'transparent',
  },
  tabCard: {
    width: 296, height: 120,
    // @ts-ignore — 极透磨砂玻璃：暖橙→深蓝 水平渐变
    backgroundImage: 'linear-gradient(90deg, rgba(239,104,55,0.22) 0%, rgba(17,68,104,0.22) 100%)',
    borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 16, paddingVertical: 14,
    justifyContent: 'flex-start',
    // @ts-ignore — CSS scroll-snap
    scrollSnapAlign: 'start',
    // @ts-ignore
    scrollSnapStop: 'always',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    // @ts-ignore — 仅玻璃内边框高光，无外阴影
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
  },
  tabCardActive: {
    // @ts-ignore — 激活：高光更亮、颜色更浓
    backgroundImage: 'linear-gradient(90deg, rgba(239,104,55,0.48) 0%, rgba(17,68,104,0.48) 100%)',
    borderColor: 'rgba(255,255,255,0.55)',
    // @ts-ignore — 仅玻璃内边框
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
  },
  tabInner: {
    flex: 1, alignItems: 'stretch',
  },
  tabTitle: {
    fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
    fontFamily: 'SF Pro Display, Helvetica Neue, Roboto, sans-serif',
    alignSelf: 'flex-start',
    // @ts-ignore
    textShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  tabTitleActive: {
    color: '#FFFFFF', fontWeight: '700',
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  /* ── 对账卡片内字段 ── */
  cardFields: {
    flex: 1, justifyContent: 'center',
  },
  cardFieldRow: {
    flexDirection: 'row',
  },
  cardFieldCol: {
    flex: 1, alignItems: 'center', gap: 2,
  },
  cardFieldLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.70)',
    fontFamily: 'SF Pro Display, Helvetica Neue, Roboto, sans-serif',
    // @ts-ignore
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  cardFieldVal: {
    fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
    fontFamily: 'SF Pro Display, Helvetica Neue, Roboto, sans-serif',
    // @ts-ignore
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
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
  dateText: {
    fontSize: 14, fontWeight: '700', color: '#000000',
    fontFamily: undefined,
  },
  dateInput: {
    fontSize: 14, fontWeight: '600', color: '#000000',
    borderWidth: 0, padding: 0, margin: 0,
    backgroundColor: 'transparent', fontFamily: 'inherit',
    // @ts-ignore
    outline: 'none',
    // @ts-ignore — native date picker icon
    WebkitAppearance: 'none',
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
    flexDirection: 'column', gap: 8,
  },
  channelChip: {
    flex: 1, minWidth: 60,
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
  /* ── Recon button ── */
  reconBtn: {
    backgroundColor: '#FA855A', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 4,
  },
  reconBtnText: {
    fontSize: 15, fontWeight: '700', color: '#FFFFFF',
  },

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
