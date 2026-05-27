import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Animated,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

/* ── helpers ── */
const fmt = (n: number) => '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString();
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => parseFloat(s) || 0;
const blockNeg = (s: string) => s.replace(/[^0-9.]/g, '');

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
export default function ExpenseScreen({ onReconHistory }: { onReconHistory?: () => void }) {
  const [activeTab, setActiveTab] = useState(0); // 0=对账, 1=营业, 2=支出
  const [showToast, setShowToast] = useState(false);
  const hideToast = () => setShowToast(false);
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
  const [recDate, setRecDate] = useState(yesterdayStr());
  const [toast, setToast] = useState('');
  const [cardBalance, setCardBalance] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [dineIn, setDineIn] = useState('');
  const [meituan, setMeituan] = useState('');
  const [flashSale, setFlashSale] = useState('');
  const [tuan, setTuan] = useState('');
  const [jd, setJd] = useState('');

  const mountedRef = useRef(false);

  // Load reconciliation data from backend
  useEffect(() => {
    if (!mountedRef.current) {
      // First mount: load the last reconciliation
      mountedRef.current = true;
      (async () => {
        try {
          const data = await api.getReconciliations(1);
          if (data && data.length > 0) {
            const last = data[0];
            const d = last.bill_date || last.date || yesterdayStr();
            setRecDate(d);
            setCardBalance(String(last.card_balance || ''));
            setCashBalance(String(last.cash_balance || ''));
            setDineIn(String(last.dine_in || ''));
            setMeituan(String(last.meituan || ''));
            setFlashSale(String(last.flash_sale || ''));
            setTuan(String(last.tuan || ''));
            setJd(String(last.jd || ''));
          }
        } catch { /* ignore */ }
      })();
      return;
    }
    // When recDate changes: fetch reconciliation for that date from backend
    (async () => {
      try {
        const data = await api.getReconciliations(365);
        const match = (data || []).find((r: any) => r.bill_date === recDate);
        if (match) {
          setCardBalance(String(match.card_balance || ''));
          setCashBalance(String(match.cash_balance || ''));
          setDineIn(String(match.dine_in || ''));
          setMeituan(String(match.meituan || ''));
          setFlashSale(String(match.flash_sale || ''));
          setTuan(String(match.tuan || ''));
          setJd(String(match.jd || ''));
        } else {
          setCardBalance('');
          setCashBalance('');
          setDineIn('');
          setMeituan('');
          setFlashSale('');
          setTuan('');
          setJd('');
        }
      } catch { /* ignore */ }
    })();
  }, [recDate]);

  // 提交对账到后端
  const submitRecon = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10); // 对账日期 = 今天
      const username = localStorage.getItem('user') || '';
      await api.createReconciliation({
        date: today,
        bill_date: recDate,
        card_balance: toNum(cardBalance),
        cash_balance: toNum(cashBalance),
        dine_in: toNum(dineIn),
        meituan: toNum(meituan),
        flash_sale: toNum(flashSale),
        jd: toNum(jd),
        tuan: toNum(tuan),
        reconciled_by: username,
      });
      setToast(t('reconComplete'));
      onReconHistory?.();
    } catch { setToast(t('toastSubmitFailed')); }
  }, [recDate, cardBalance, cashBalance, dineIn, meituan, flashSale, tuan, jd, onReconHistory]);

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
    } catch { setToast(t('toastLoadFailed')); }
  };
  useEffect(() => { loadRevenue(); }, []);

  /* ── 模块三：支出 ── */
  const [expDate, setExpDate] = useState(todayStr());
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('日常');
  const [payMethod, setPayMethod] = useState('现金');
  const [expNote, setExpNote] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expCatTotals, setExpCatTotals] = useState({ daily: 0, rent: 0, salary: 0, goods: 0 });
  const [loadingExp, setLoadingExp] = useState(false);

  const loadExpenses = async () => {
    try {
      // Load all expense transactions for complete category totals
      const allExpenses: any[] = [];
      let page = 1;
      while (true) {
        const tx: any = await api.getTransactions(page);
        const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
        allExpenses.push(...exps);
        if (page >= (tx.pages || 1)) break;
        page++;
      }
      setExpenses(allExpenses);
      // Compute category totals
      let daily = 0, rent = 0, salary = 0, goods = 0;
      allExpenses.forEach((e: any) => {
        const cat = e.category || '';
        const amt = e.amount || 0;
        if (cat.includes('日常')) daily += amt;
        else if (cat.includes('房租')) rent += amt;
        else if (cat.includes('薪资')) salary += amt;
        else if (cat.includes('采购')) goods += amt;
      });
      setExpCatTotals({ daily, rent, salary, goods });
    } catch { setToast(t('toastLoadFailed')); }
  };
  useEffect(() => { loadExpenses(); }, []);

  const handleAddExpense = async () => {
    if (!expAmount) return;
    setLoadingExp(true);
    try {
      await api.createTransaction({
        type: 'expense',
        amount: parseFloat(expAmount),
        category: expCategory,
        account: payMethod,
        note: expNote,
      });
      setExpAmount('');
      setPayMethod('现金');
      setExpNote('');
      await loadExpenses();
    } catch { setToast(t('toastSubmitFailed')); }
    setLoadingExp(false);
  };

  /* ── 卡片摘要数据 ── */
  const tabCards = [
    { gradient: ['rgba(13,148,136,0.22)', 'rgba(101,163,13,0.22)'], gradientActive: ['rgba(13,148,136,0.48)', 'rgba(101,163,13,0.48)'], title: t('tabRecon'), stat: diff, statFmt: fmt(diff), statColor: diff >= 0 ? '#059669' : '#DC2626', prefix: diff >= 0 ? '+' : '' },
    { gradient: ['rgba(236,72,153,0.22)', 'rgba(249,115,22,0.22)'], gradientActive: ['rgba(236,72,153,0.48)', 'rgba(249,115,22,0.48)'], title: t('tabRevenue'), stat: revenueData.todayRevenue, statFmt: fmt(revenueData.todayRevenue), statColor: '#1A1A1A', prefix: '' },
    { gradient: ['rgba(220,38,38,0.22)', 'rgba(153,27,27,0.22)'], gradientActive: ['rgba(220,38,38,0.48)', 'rgba(153,27,27,0.48)'], title: t('tabExpense'), stat: expCatTotals.daily + expCatTotals.rent + expCatTotals.salary + expCatTotals.goods, statFmt: fmt(expCatTotals.daily + expCatTotals.rent + expCatTotals.salary + expCatTotals.goods), statColor: '#1A1A1A', prefix: '' },
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
            const bgGrad = active ? tab.gradientActive : tab.gradient;
            return (
              <TouchableOpacity
                key={i}
                testID="snap-card"
                style={[st.tabCard, active && st.tabCardActive, {
                  // @ts-ignore — 每张卡片独立渐变色
                  backgroundImage: `linear-gradient(90deg, ${bgGrad[0]} 0%, ${bgGrad[1]} 100%)`,
                }]}
                onPress={() => setActiveTab(i)}
                activeOpacity={0.7}
              >
                <View style={st.tabInner}>
                  <Text style={[st.tabTitle, active && st.tabTitleActive]}>
                    {tab.title}{i === 2 ? ' ¥' + fmtInt(expCatTotals.daily + expCatTotals.rent + expCatTotals.salary + expCatTotals.goods) : ''}
                  </Text>
                  {i === 0 && (
                    <View style={st.cardFields}>
                      <View style={st.cardFieldRow}>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>{t('bookBalance')}</Text>
                          <Text style={st.cardFieldVal}>¥{fmtInt(channelTotal)}</Text>
                        </View>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>{t('currentBalance')}</Text>
                          <Text style={st.cardFieldVal}>¥{fmtInt(realTotal)}</Text>
                        </View>
                        <View style={st.cardFieldCol}>
                          <Text style={st.cardFieldLabel}>{t('bookDiff')}</Text>
                          <Text style={[st.cardFieldVal, { color: diff >= 0 ? '#E6F7EE' : '#FCA5A5' }]}>{diff >= 0 ? '+' : '-'}¥{fmtInt(Math.abs(diff))}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                {i === 2 && (
                  <View style={st.cardFields}>
                    <View style={st.cardFieldRow}>
                      <View style={st.cardFieldCol}>
                        <Text style={st.cardFieldLabel}>{t('daily')}</Text>
                        <Text style={st.cardFieldVal}>¥{fmtInt(expCatTotals.daily)}</Text>
                      </View>
                      <View style={st.cardFieldCol}>
                        <Text style={st.cardFieldLabel}>{t('rent')}</Text>
                        <Text style={st.cardFieldVal}>¥{fmtInt(expCatTotals.rent)}</Text>
                      </View>
                      <View style={st.cardFieldCol}>
                        <Text style={st.cardFieldLabel}>{t('salary')}</Text>
                        <Text style={st.cardFieldVal}>¥{fmtInt(expCatTotals.salary)}</Text>
                      </View>
                      <View style={st.cardFieldCol}>
                        <Text style={st.cardFieldLabel}>{t('goods')}</Text>
                        <Text style={st.cardFieldVal}>¥{fmtInt(expCatTotals.goods)}</Text>
                      </View>
                    </View>
                  </View>
                )}
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
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#6B7280' }}>{t('billDate')}</Text>
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
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#9CA3AF' }}>›</Text>
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
                  value={cardBalance} onChangeText={(v: string) => setCardBalance(blockNeg(v))}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor="#D1D5DB" />
              </View>
              <View style={st.inputGroup}>
                <Text style={st.inputLabel}>{t('cashBalance')} 💴</Text>
                <InputWithFocus inputStyle={st.input}
                  value={cashBalance} onChangeText={(v: string) => setCashBalance(blockNeg(v))}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor="#D1D5DB" />
              </View>
            </View>

            {/* 在途资金 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#6B7280' }}>{t('fundsInTransit')}</Text>
              <NumberTicker value={channelTotal} style={{ fontSize: 14, fontWeight: '700', color: '#C93638' }} />
            </View>
            <View style={st.channelGrid}>
              {/* Row 1: 堂食 + 美团 + 闪购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('dineIn')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={dineIn} onChangeText={(v: string) => setDineIn(blockNeg(v))}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('meituan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={meituan} onChangeText={(v: string) => setMeituan(blockNeg(v))}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('flashSale')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={flashSale} onChangeText={(v: string) => setFlashSale(blockNeg(v))}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
              </View>
              {/* Row 2: 京东 + 团购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('jd')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={jd} onChangeText={(v: string) => setJd(blockNeg(v))}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('tuan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={tuan} onChangeText={(v: string) => setTuan(blockNeg(v))}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 按钮行：对账记录(左) + 添加(右) */}
            <View style={st.btnRow}>
              <TouchableOpacity style={st.reconRecordBtn} onPress={onReconHistory} activeOpacity={0.8}>
                <Text style={st.reconRecordBtnText}>{t('reconHistory')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.reconBtn} onPress={() => setShowToast(true)} activeOpacity={0.8}>
                <Text style={st.reconBtnText}>{t('reconComplete')}</Text>
              </TouchableOpacity>
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
              {/* 大金额输入 */}
              <View style={st.bigAmtWrap}>
                <Text style={st.bigAmtLabel}>{t('amountLabel')}</Text>
                <View style={st.bigAmtRow}>
                  <Text style={st.bigAmtSymbol}>¥</Text>
                  <TextInput style={st.bigAmtInput}
                    value={expAmount} onChangeText={(v: string) => setExpAmount(blockNeg(v))}
                    keyboardType="decimal-pad" placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    autoFocus={false} />
                </View>
                <View style={st.amtCursor} />
              </View>
              {/* 分类胶囊 */}
              <Text style={st.catSectionTitle}>{t('expenseCategory')}</Text>
              <View style={st.catGrid}>
                {(() => {
                  const icons: Record<string, React.ReactElement> = {
                    '日常': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><Path d="M9 22V12h6v10"/></Svg>,
                    '房租': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Path d="M1 22V8.5L12 2l11 6.5V22"/><Rect x="8" y="14" width="8" height="8" rx="1"/></Svg>,
                    '薪资': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Circle cx="12" cy="12" r="10"/><Path d="M16 8h-4a2 2 0 100 4h2a2 2 0 110 4H8"/><Path d="M12 6v2M12 16v2"/></Svg>,
                    '采购': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><Line x1="3" y1="6" x2="21" y2="6"/><Path d="M16 10a4 4 0 01-8 0"/></Svg>,
                  };
                  const keys: Record<string, string> = { '日常': 'daily', '房租': 'rent', '薪资': 'salary', '采购': 'goods' };
                  return (['日常', '房租', '薪资', '采购'] as const).map((cat) => {
                    const active = expCategory === cat;
                    return (
                      <TouchableOpacity key={cat} style={[st.catChip, active && st.catChipActive]}
                        onPress={() => setExpCategory(cat)} activeOpacity={0.7}>
                        <View style={{ marginRight: 5 }}>{icons[cat]}</View>
                        <Text style={[st.catChipText, active && st.catChipTextActive]}>{t(keys[cat] as any)}</Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
              {/* 支付方式 */}
              <Text style={st.catSectionTitle}>{t('paymentMethod')}</Text>
              <View style={st.payGrid}>
                {(() => {
                  const payIcons: Record<string, React.ReactElement> = {
                    '现金': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Rect x="2" y="6" width="20" height="12" rx="2"/><Circle cx="12" cy="12" r="2"/><Path d="M2 10h20"/></Svg>,
                    '微信': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></Svg>,
                    '支付宝': <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><Path d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z"/><Path d="M10 14l2 2 4-4"/></Svg>,
                  };
                  const keyMap: Record<string, string> = { '现金': 'payCash', '微信': 'payWechat', '支付宝': 'payAlipay' };
                  return (['现金', '微信', '支付宝'] as const).map((m) => {
                    const active = payMethod === m;
                    const isWechat = m === '微信';
                    return (
                      <TouchableOpacity key={m}
                        style={[st.payChip, active && (isWechat ? st.payChipActiveWechat : st.payChipActive)]}
                        onPress={() => setPayMethod(m)} activeOpacity={0.7}>
                        <View style={{ marginRight: 5 }}>{payIcons[m]}</View>
                        <Text style={[st.payChipText, active && st.payChipTextActive]}>{t(keyMap[m] as any)}</Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
              {/* 支出说明 */}
              <Text style={st.catSectionTitle}>{t('expenseNote')}</Text>
              <InputWithFocus inputStyle={st.noteInput}
                value={expNote}
                onChangeText={setExpNote}
                placeholder={t('notePlaceholder')}
                placeholderTextColor="#D1D5DB"
                multiline />
              <TouchableOpacity
                style={st.expBtn}
                onPress={handleAddExpense}
                disabled={!expAmount || loadingExp}
                activeOpacity={0.8}
              >
                <Text style={st.expBtnText}>
                  {loadingExp ? '...' : t('confirmRecord')}
                </Text>
                {(!expAmount || loadingExp) && (
                  <View style={st.expBtnMask} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>
        )}
      </ScrollView>

      {/* 添加提示弹窗 */}
      {showToast && (
        <View style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBackdrop} onPress={hideToast} activeOpacity={1} />
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('friendlyReminder')}</Text>
              <TouchableOpacity onPress={hideToast}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={{ fontSize: 14, color: '#4B5563', textAlign: 'center' }}>
                {t('jokeRecon')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={st.modalCancelBtn} onPress={hideToast}>
                  <Text style={st.modalCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalBtn} onPress={() => { hideToast(); submitRecon(); }}>
                  <Text style={st.modalBtnText}>{t('confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
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
    // @ts-ignore — 响应式：屏宽 - 左边距18 - 右侧peek 43
    width: 'calc(100vw - 61px)', height: 120,
    // @ts-ignore — 极透磨砂玻璃：渐变色在 render 中动态设置
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
    // @ts-ignore — 激活：高光更亮（渐变色由 render 动态设置）
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
  totalExpLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.70)',
    textAlign: 'center', marginBottom: 6,
  },
  totalExpVal: {
    fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.95)',
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
    paddingHorizontal: 18, paddingBottom: 150, gap: 0,
  },
  moduleWrap: {
    width: '100%',
  },

  /* ── Content Card (glass) ── */
  card: {
    borderRadius: 14,
    paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12,
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
    paddingVertical: 4, paddingHorizontal: 4,
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
  /* ── Recon buttons ── */
  btnRow: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  reconBtn: {
    flex: 1, backgroundColor: '#FA855A', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  reconBtnText: {
    fontSize: 15, fontWeight: '700', color: '#FFFFFF',
  },
  reconRecordBtn: {
    flex: 1, backgroundColor: '#B3CFE5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  reconRecordBtnText: {
    fontSize: 14, fontWeight: '600', color: '#4B5563',
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
  expForm: { gap: 14 },
  /* Big amount input */
  bigAmtWrap: { alignItems: 'center', paddingVertical: 16 },
  bigAmtLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  bigAmtRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bigAmtSymbol: { fontSize: 42, fontWeight: '300', color: '#FA855A', marginRight: 6 },
  bigAmtInput: {
    fontSize: 42, fontWeight: '700', color: '#1A1A1A',
    borderWidth: 0, backgroundColor: 'transparent',
    textAlign: 'left', padding: 0,
    fontFamily: 'SF Pro Display, Helvetica Neue, sans-serif',
    flex: 0, width: 180,
    // @ts-ignore
    outline: 'none',
  },
  amtCursor: {
    width: 40, height: 2, backgroundColor: '#FA855A',
    marginTop: 10, borderRadius: 1,
  },
  /* Category chips */
  catSectionTitle: { fontSize: 12, color: '#1A1A1A', fontWeight: '700', marginBottom: 10 },
  catGrid: { flexDirection: 'row', gap: 8 },
  catChip: {
    flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 22,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  catChipActive: { backgroundColor: '#FA855A' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catChipTextActive: { color: '#FFFFFF' },
  /* Payment method chips */
  payGrid: { flexDirection: 'row', gap: 8 },
  payChip: {
    flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 22,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  payChipActive: { backgroundColor: '#FA855A' },
  payChipActiveWechat: { backgroundColor: '#07C160' },
  payChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  payChipTextActive: { color: '#FFFFFF' },
  /* Expense note */
  noteInput: {
    fontSize: 14, color: '#1A1A1A',
    borderWidth: 0, backgroundColor: '#F9FAFB',
    borderRadius: 10, padding: 12, minHeight: 60,
    textAlignVertical: 'top',
  },
  expFormRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  expCatLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  expBtn: {
    backgroundColor: '#FA855A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', position: 'relative', overflow: 'hidden',
  },
  expBtnMask: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12,
  },
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

  /* ── Modal ── */
  modalOverlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,26,26,0.4)',
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 20, width: 320, maxWidth: '100%',
    overflow: 'hidden',
    // @ts-ignore
    animationName: 'modalIn', animationDuration: '0.2s', animationTimingFunction: 'ease',
    // @ts-ignore
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
  },
  modalHeader: {
    backgroundColor: '#8B1E22', paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modalClose: { color: '#FECACA', fontSize: 18 },
  modalBtn: {
    flex: 1, backgroundColor: '#8B1E22', borderRadius: 14,
    paddingVertical: 10, alignItems: 'center',
  },
  modalBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
  modalCancelBtn: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingVertical: 10, alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '500', color: '#4B5563' },
});
