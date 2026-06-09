import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Animated, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';
import ModalOverlay from '../components/ModalOverlay';
import NumberTicker from '../components/NumberTicker';
import FadeInView from '../components/FadeInView';
import DateErrorHint from '../components/DateErrorHint';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { modalCardAnimation, modalClose, uploadReceiptStyles } from '../sharedStyles';
import { fmtAmt as fmt } from '../utils/format';
import { getCurrentUser } from '../utils/storage';
import { useExpenseForm } from './expense/useExpenseForm';
import CategoryChips from '../components/CategoryChips';
import PaymentMethodChips from '../components/PaymentMethodChips';
import ExpenseNoteInput from '../components/ExpenseNoteInput';

/* ── helpers ── */
const fmtInt = (n: number) => n.toLocaleString();
const cnNow = () => { const d = new Date(); return new Date(d.getTime() + 8 * 3600000); };
const yesterdayStr = () => { const d = cnNow(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const todayStr = () => cnNow().toISOString().slice(0, 10);
const isFuture = (d: string) => d > todayStr();
const fmtLocalDate = (s: string) => {
  const [y, m, d] = s.split('-');
  const l = getLang();
  if (l.startsWith('en')) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[+m-1]} ${+d}, ${y}`;
  }
  return `${y}年${m}月${d}日`;
};
const fmtMonth = (year: number, month: number) => {
  const l = getLang();
  if (l.startsWith('en')) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[month-1]} ${year}`;
  }
  return `${year}年${String(month).padStart(2, '0')}月`;
};
const toNum = (s: string) => parseFloat(s) || 0;
const blockNeg = (s: string) => s.replace(/[^0-9.]/g, '');
const fmtDecInput = (s: string) => { s = blockNeg(s); return s.startsWith('.') ? '0' + s : s; };
const toDec2 = (v: any) => String((parseFloat(String(v ?? 0)) || 0).toFixed(2));
const toDec2Comma = (v: any) => {
  const n = parseFloat(String(v ?? 0)) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ═══════════════════════════════════════════════════════════
   InputWithFocus — 聚焦时边框过渡到品牌红
   ═══════════════════════════════════════════════════════════ */
function InputWithFocus({ style, inputStyle, ...props }: any) {
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();

  return (
    <TextInput
      {...props}
      onFocus={(e: any) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e: any) => { setFocused(false); props.onBlur?.(e); }}
      style={[
        inputStyle,
        {
          borderColor: focused ? colors.primary : colors.secondary,
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
export default function ExpenseScreen({ onReconHistory, onExpenseHistory }: { onReconHistory?: () => void; onExpenseHistory?: () => void }) {
  const { colors } = useTheme();
  const urlCache = useRef<Map<File, string>>(new Map());
  const getPreviewUrl = (file: File) => {
    if (!urlCache.current.has(file)) urlCache.current.set(file, URL.createObjectURL(file));
    return urlCache.current.get(file)!;
  };
  const revokePreviewUrl = (file: File) => {
    const url = urlCache.current.get(file);
    if (url) { URL.revokeObjectURL(url); urlCache.current.delete(file); }
  };
  const clearUrlCache = () => { urlCache.current.forEach(u => URL.revokeObjectURL(u)); urlCache.current.clear(); };
  useEffect(() => { return () => clearUrlCache(); }, []);

  // Load business summary from backend
  useEffect(() => {
    api.getBusinessSummary().then((data: any) => {
      setBusinessSummary(data || {});
    }).catch(() => {});
  }, []);

  const [activeTab, setActiveTabState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('expense_active_tab');
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });
  const setActiveTab = (i: number) => {
    setActiveTabState(i);
    if (i === 1) setExpDateErr(0);
    try { localStorage.setItem('expense_active_tab', String(i)); } catch {}
  };
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
        setActiveTab(Math.min(1, Math.max(0, idx)));
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
  const [recDateKey, setRecDateKey] = useState(0);
  const [recDateErr, setRecDateErr] = useState(0);
  const [toast, setToast] = useState('');
  const [businessSummary, setBusinessSummary] = useState<any>({});
  const [cardBalance, setCardBalance] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [dineIn, setDineIn] = useState('');
  const [meituan, setMeituan] = useState('');
  const [flashSale, setFlashSale] = useState('');
  const [tuan, setTuan] = useState('');
  const [jd, setJd] = useState('');

  const initReconValues = useRef({ card: '', cash: '', dine: '', mt: '', fs: '', jd: '', tuan: '' });
  const reconJustLoaded = useRef(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Load reconciliation data from backend
  // Rule:
  //   1. Exact match on bill_date → show that record's values
  //   2. No match + recDate >= last bill_date → fill with last record's values
  //   3. No match + recDate < last bill_date → leave empty
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getReconciliations(365);
        if (!data || data.length === 0) {
          setCardBalance(''); setCashBalance('');
          setDineIn(''); setMeituan('');
          setFlashSale(''); setTuan(''); setJd('');
          reconJustLoaded.current = true;
          return;
        }
        const last = data[0]; // most recent record
        const match = data.find((r: any) => r.bill_date === recDate);
        if (match) {
          setCardBalance(toDec2(match.card_balance));
          setCashBalance(toDec2(match.cash_balance));
          setDineIn(toDec2(match.dine_in));
          setMeituan(toDec2(match.meituan));
          setFlashSale(toDec2(match.flash_sale));
          setTuan(toDec2(match.tuan));
          setJd(toDec2(match.jd));
        } else if (recDate >= (last.bill_date || '')) {
          setCardBalance(toDec2(last.card_balance));
          setCashBalance(toDec2(last.cash_balance));
          setDineIn(toDec2(last.dine_in));
          setMeituan(toDec2(last.meituan));
          setFlashSale(toDec2(last.flash_sale));
          setTuan(toDec2(last.tuan));
          setJd(toDec2(last.jd));
        } else {
          setCardBalance(''); setCashBalance('');
          setDineIn(''); setMeituan('');
          setFlashSale(''); setTuan(''); setJd('');
        }
        reconJustLoaded.current = true;
      } catch { setToast(t('toastLoadFailed')); }
    })();
  }, [recDate]);

  // Capture initial values after data load settles
  useEffect(() => {
    if (reconJustLoaded.current) {
      reconJustLoaded.current = false;
      initReconValues.current = { card: cardBalance, cash: cashBalance, dine: dineIn, mt: meituan, fs: flashSale, jd, tuan };
      forceUpdate();
    }
  }, [cardBalance, cashBalance, dineIn, meituan, flashSale, jd, tuan]);

  // 提交对账到后端
  const submitRecon = useCallback(async () => {
    if (isFuture(recDate)) { setToast(t('errDateFuture')); return; }
    try {
      const today = new Date().toISOString().slice(0, 10);
      const username = getCurrentUser();
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
  const realTotal = toNum(cardBalance) + toNum(cashBalance) + channelTotal;
  const diff = (businessSummary.cash_on_hand || 0) - realTotal;

  const hasReconChanges =
    toNum(cardBalance) !== toNum(initReconValues.current.card) ||
    toNum(cashBalance) !== toNum(initReconValues.current.cash) ||
    toNum(dineIn) !== toNum(initReconValues.current.dine) ||
    toNum(meituan) !== toNum(initReconValues.current.mt) ||
    toNum(flashSale) !== toNum(initReconValues.current.fs) ||
    toNum(jd) !== toNum(initReconValues.current.jd) ||
    toNum(tuan) !== toNum(initReconValues.current.tuan);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const [feeData, setFeeData] = useState<any>(null);        // current month
  const [allFees, setAllFees] = useState<any[]>([]);         // all months for detail
  const [feeMonth, setFeeMonth] = useState<'all' | { year: number; month: number }>({ year: thisYear, month: thisMonth });
  const [showFeeMonthPicker, setShowFeeMonthPicker] = useState(false);
  const [showFeeSheet, setShowFeeSheet] = useState(false);
  const [showFeeHistory, setShowFeeHistory] = useState(false);
  const [feeHistoryFilter, setFeeHistoryFilter] = useState<'all' | { year: number; month: number }>('all');
  const [showFeeHistoryFilterPicker, setShowFeeHistoryFilterPicker] = useState(false);
  const [feeEntryDate, setFeeEntryDate] = useState(todayStr());
  const [feeDateErr, setFeeDateErr] = useState(0);
  const [feeMc, setFeeMc] = useState('');
  const [feeMw, setFeeMw] = useState('');
  const [feeEw, setFeeEw] = useState('');
  const [feeMt, setFeeMt] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const pickerTriggerRef = useRef<any>(null);
  const feeHistoryFilterTriggerRef = useRef<any>(null);
  const [pickerAnim] = useState(new Animated.Value(0));
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [feeHistoryPickerPos, setFeeHistoryPickerPos] = useState({ top: 0, left: 0 });

  const loadFeeData = async () => {
    try {
      const all = await api.getPlatformFees();
      const allArr = Array.isArray(all) ? all : [];
      setAllFees(allArr);
      // Derive feeData from feeMonth
      if (feeMonth !== 'all') {
        const match = allArr.find((f: any) => f.year === feeMonth.year && f.month === feeMonth.month);
        setFeeData(match || null);
      } else {
        setFeeData(null);
      }
    } catch { setToast(t('toastLoadFailed')); }
  };
  useEffect(() => { loadFeeData(); }, [feeMonth]);

  const handleAddFee = async () => {
    if (feeMonth === 'all') return;
    if (isFuture(feeEntryDate)) { setToast(t('errDateFuture')); return; }
    const mc = toNum(feeMc), mw = toNum(feeMw), ew = toNum(feeEw), mt = toNum(feeMt);
    if (mc + mw + ew + mt === 0) { setToast(t('atLeastOneFee')); return; }
    setSavingFee(true);
    try {
      const r = await api.addPlatformFeeEntry({
        year: feeMonth.year, month: feeMonth.month,
        entry_date: feeEntryDate,
        meituan_cashier: mc, meituan_waimai: mw,
        shangou_waimai: ew, meituan_tuan: mt,
      });
      if (r?.status === 'ok') {
        setFeeData(r?.data);
        setFeeMc(''); setFeeMw(''); setFeeEw(''); setFeeMt('');
        setShowFeeSheet(false);
        // Reload all months to keep totals accurate
        api.getPlatformFees().then((all: any) => setAllFees(Array.isArray(all) ? all : [])).catch(() => {});
      } else {
        setToast(r?.message || t('toastSubmitFailed'));
      }
    } catch { setToast(t('toastSubmitFailed')); }
    setSavingFee(false);
  };

  /* ── 模块三：支出 ── */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const expDateInputRef = useRef<HTMLInputElement>(null);

  const {
    expDate, setExpDate, expDateErr, setExpDateErr,
    expAmount, setExpAmount,
    expCategory, setExpCategory,
    payMethod, setPayMethod,
    expNote, setExpNote,
    expImages, setExpImages,
    uploadingImg,
    expenses, expCatTotals,
    loadingExp,
    showExpConfirm, setShowExpConfirm,
    handleAddExpense, loadExpenses,
    handleImageSelect, removeImage,
    handleExpDateChange, resetForm,
    isAmountInvalid,
    fmtDecInput, toDec2Comma, todayStr: _hookTodayStr,
  } = useExpenseForm({
    onExpenseHistory,
    getPreviewUrl,
    revokePreviewUrl,
    clearUrlCache,
    fileInputRef,
    expDateInputRef,
    onToast: setToast,
  });

  const [showImgTip, setShowImgTip] = useState(false);

  // Sync uncontrolled date inputs when state changes externally
  const recDateInputRef = useRef<HTMLInputElement>(null);
  const feeDateInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (recDateInputRef.current) recDateInputRef.current.value = recDate; }, [recDate]);
  useEffect(() => { if (expDateInputRef.current) expDateInputRef.current.value = expDate; }, [expDate]);
  useEffect(() => { if (feeDateInputRef.current) feeDateInputRef.current.value = feeEntryDate; }, [feeEntryDate]);

  /* ── 卡片摘要数据 ── */
  const feeTotal = feeMonth === 'all'
    ? allFees.reduce((sum: number, f: any) => sum + (f.meituan_cashier || 0) + (f.meituan_waimai || 0) + (f.shangou_waimai || 0) + (f.meituan_tuan || 0), 0)
    : feeData
    ? ((feeData.meituan_cashier || 0) + (feeData.meituan_waimai || 0) + (feeData.shangou_waimai || 0) + (feeData.meituan_tuan || 0))
    : 0;
  const lang = getLang();
  const tabCards = useMemo(() => [
    { gradient: [withAlpha(colors.success, 0.22), withAlpha(colors.info, 0.22)], gradientActive: [withAlpha(colors.success, 0.48), withAlpha(colors.info, 0.48)], title: t('tabRecon'), stat: diff, statFmt: fmt(diff), statColor: diff >= 0 ? colors.success : colors.danger, prefix: diff >= 0 ? '+' : '' },
    { gradient: [withAlpha(colors.danger, 0.22), withAlpha(colors.primary, 0.22)], gradientActive: [withAlpha(colors.danger, 0.48), withAlpha(colors.primary, 0.48)], title: t('tabExpense'), stat: businessSummary.cumulative_expense || 0, statFmt: fmt(businessSummary.cumulative_expense || 0), statColor: colors.textMain, prefix: '' },
  ], [diff, businessSummary.cumulative_expense, colors, lang]);

  const st = useMemo(() => getSt(colors), [colors]);

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
                },
                // @ts-ignore — 支出卡片去掉右侧peek
                i === 1 && { width: 'calc(100vw - 32px)' },
                ]}
                onPress={() => setActiveTab(i)}
                activeOpacity={0.7}
              >
                <View style={st.tabInner}>
                  <Text style={[st.tabTitle, active && st.tabTitleActive]}>
                    {tab.title}{i === 1 ? ' ¥' + fmtInt(businessSummary.cumulative_expense || 0) : ''}
                  </Text>
                  {i === 0 && (
                    <View style={{ flex: 1, gap: 12 }}>
                      {/* Hero: 账面差额 */}
                      <View style={{ alignItems: 'flex-start', gap: 2, marginTop: 16 }}>
                        {/* @ts-ignore */}
                        <Text style={{
                          fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                          color: 'rgba(255,255,255,0.70)',
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        } as any}>{t('bookDiff')}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          {/* @ts-ignore */}
                          <Text style={{
                            fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                            color: (() => {
                              if (diff > 0.005) return colors.primary;
                              if (diff < -0.005) return colors.danger;
                              return colors.textMain;
                            })(),
                            textShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          } as any}>{diff >= 0 ? '+' : '-'}¥</Text>
                          {/* @ts-ignore */}
                          <Text style={{
                            fontSize: FONTS.h1.size + 4, fontWeight: FONTS.h1.weight,
                            color: (() => {
                              if (diff > 0.005) return colors.primary;
                              if (diff < -0.005) return colors.danger;
                              return colors.textMain;
                            })(),
                            textShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          } as any}>{toDec2Comma(Math.abs(diff))}</Text>
                        </View>
                      </View>
                      {/* Sub-cards: 账面余额 | 当前资金 */}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{
                          flex: 1, backgroundColor: withAlpha(colors.success, 0.15),
                          borderRadius: 10, padding: 14, gap: 6,
                          borderWidth: 0.5, borderColor: withAlpha(colors.success, 0.30),
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        } as any}>
                          <Text style={{
                            fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                            color: 'rgba(255,255,255,0.70)',
                          }}>{t('bookBalance')}</Text>
                          <Text style={{
                            fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                            color: 'rgba(255,255,255,0.95)',
                          }}>{'¥' + toDec2Comma(businessSummary.cash_on_hand || 0)}</Text>
                        </View>
                        <View style={{
                          flex: 1, backgroundColor: withAlpha(colors.info, 0.15),
                          borderRadius: 10, padding: 14, gap: 6,
                          borderWidth: 0.5, borderColor: withAlpha(colors.info, 0.30),
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        } as any}>
                          <Text style={{
                            fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                            color: 'rgba(255,255,255,0.70)',
                          }}>{t('currentBalance')}</Text>
                          <Text style={{
                            fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                            color: 'rgba(255,255,255,0.95)',
                          }}>{'¥' + toDec2Comma(realTotal)}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  </View>
                {i === 1 && (
                  <View style={{ transform: [{ translateY: -16 }] }}>
                    {/* Row 1: 日常 | 采购 */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{
                        flex: 1, backgroundColor: withAlpha(colors.danger, 0.15),
                        borderRadius: 10, padding: 10, gap: 4,
                        borderWidth: 0.5, borderColor: withAlpha(colors.danger, 0.30),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      } as any}>
                        <Text style={{
                          fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                          color: 'rgba(255,255,255,0.70)',
                        }}>{t('daily')}</Text>
                        <Text style={{
                          fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                          color: 'rgba(255,255,255,0.95)',
                        }}>{'¥' + toDec2Comma(expCatTotals.daily)}</Text>
                      </View>
                      <View style={{
                        flex: 1, backgroundColor: withAlpha(colors.primary, 0.15),
                        borderRadius: 10, padding: 10, gap: 4,
                        borderWidth: 0.5, borderColor: withAlpha(colors.primary, 0.30),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      } as any}>
                        <Text style={{
                          fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                          color: 'rgba(255,255,255,0.70)',
                        }}>{t('goods')}</Text>
                        <Text style={{
                          fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                          color: 'rgba(255,255,255,0.95)',
                        }}>{'¥' + toDec2Comma(expCatTotals.goods)}</Text>
                      </View>
                    </View>
                    {/* Row 2: 房租 | 薪资 */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <View style={{
                        flex: 1, backgroundColor: withAlpha(colors.danger, 0.15),
                        borderRadius: 10, padding: 10, gap: 4,
                        borderWidth: 0.5, borderColor: withAlpha(colors.danger, 0.30),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      } as any}>
                        <Text style={{
                          fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                          color: 'rgba(255,255,255,0.70)',
                        }}>{t('rent')}</Text>
                        <Text style={{
                          fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                          color: 'rgba(255,255,255,0.95)',
                        }}>{'¥' + toDec2Comma(expCatTotals.rent)}</Text>
                      </View>
                      <View style={{
                        flex: 1, backgroundColor: withAlpha(colors.primary, 0.15),
                        borderRadius: 10, padding: 10, gap: 4,
                        borderWidth: 0.5, borderColor: withAlpha(colors.primary, 0.30),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      } as any}>
                        <Text style={{
                          fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
                          color: 'rgba(255,255,255,0.70)',
                        }}>{t('salary')}</Text>
                        <Text style={{
                          fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
                          color: 'rgba(255,255,255,0.95)',
                        }}>{'¥' + toDec2Comma(expCatTotals.salary)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={st.contentScroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={st.contentInner}>

        {/* ── 模块一：每日对账 ── */}
        {activeTab === 0 && (
        <FadeInView style={st.moduleWrap}>
          {/* Platform fees card */}
          <View style={[st.card, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain }}>{t('platformFee')}</Text>
                <TouchableOpacity
                  ref={pickerTriggerRef}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2, position: 'relative', paddingTop: 2 }}
                  onPress={() => {
                    if (!showFeeMonthPicker) {
                      // Measure trigger position for dropdown placement
                      if (pickerTriggerRef.current && typeof (pickerTriggerRef.current as any).measure === 'function') {
                        (pickerTriggerRef.current as any).measure((_x: number, _y: number, _w: number, _h: number, px: number, py: number) => {
                          setPickerPos({ top: py + 30, left: px });
                        });
                      }
                      pickerAnim.setValue(0);
                      Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
                      setShowFeeMonthPicker(true);
                    } else {
                      Animated.timing(pickerAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                        setShowFeeMonthPicker(false);
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: FONTS.microBold.size, color: colors.primary, fontWeight: FONTS.microBold.weight }}>
                    {feeMonth === 'all' ? t('feeAllMonths') : fmtMonth(feeMonth.year, feeMonth.month)}
                  </Text>
                  <Text style={{ fontSize: FONTS.micro.size, color: colors.primary }}>▼</Text>
                </TouchableOpacity>
              </View>
              {(feeMonth !== 'all' || allFees.length > 0) && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                onPress={() => {
                  if (feeMonth === 'all') {
                    setShowFeeHistory(true); setFeeHistoryFilter('all');
                  } else {
                    setFeeMc(''); setFeeMw(''); setFeeEw(''); setFeeMt('');
                    setFeeDateErr(0); loadFeeData(); setShowFeeSheet(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: FONTS.subBold.size, color: colors.primary, fontWeight: FONTS.subBold.weight }}>
                  {feeMonth === 'all' ? t('feeViewDetail') : t('feeDetail')}
                </Text>
                <Text style={{ fontSize: FONTS.body.size, color: colors.primary, fontWeight: FONTS.h2.weight }}>→</Text>
              </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 }}>
              <Text style={{ fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: colors.primary, marginRight: 6 }}>¥</Text>
              <Text style={{ fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: colors.textMain }}>
                {feeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {([
                { k: 'meituanCashier', v: feeMonth === 'all' ? allFees.reduce((s: number, f: any) => s + (f.meituan_cashier || 0), 0) : (feeData?.meituan_cashier || 0), color: colors.info },
                { k: 'meituanWaimai', v: feeMonth === 'all' ? allFees.reduce((s: number, f: any) => s + (f.meituan_waimai || 0), 0) : (feeData?.meituan_waimai || 0), color: colors.warning },
                { k: 'shangouWaimai', v: feeMonth === 'all' ? allFees.reduce((s: number, f: any) => s + (f.shangou_waimai || 0), 0) : (feeData?.shangou_waimai || 0), color: colors.info },
                { k: 'meituanTuan', v: feeMonth === 'all' ? allFees.reduce((s: number, f: any) => s + (f.meituan_tuan || 0), 0) : (feeData?.meituan_tuan || 0), color: colors.success },
              ] as const).map((p) => (
                <View key={p.k} style={{ flex: 1, minWidth: '45%', backgroundColor: colors.bg, borderRadius: 10, padding: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
                    <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight }}>{t(p.k)}</Text>
                  </View>
                  <Text style={{ fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.textMain }}>
                    ¥{p.v.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 日记账 */}
          <View style={[st.card, { marginTop: 16 }]}>
            {/* 日期行 */}
            <View style={st.dateRow}>
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub }}>{t('billDate')}</Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative' }}
              >
                <Text style={st.dateText}>
                  {(() => {
                    const l = getLang();
                    const [y, m, d] = recDate.split('-');
                    if (l.startsWith('en')) {
                      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                      return `${months[+m-1]} ${+d}, ${y}`;
                    }
                    if (l === 'zh-Hant' || l === 'zh-TW') {
                      return `${y}年${m}月${d}日`;
                    }
                    return `${y}年${m}月${d}日`;
                  })()}
                </Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: 0 }] }}><Path d="M10 6l6 6-6 6"/></Svg>
                {React.createElement('input', {
                  ref: recDateInputRef,
                  type: 'date',
                  key: recDateKey,
                  defaultValue: recDate,
                  max: todayStr(),
                  onChange: (e: any) => { if (isFuture(e.target.value)) { recDateInputRef.current!.value = recDate; setRecDateKey(k => k + 1); setRecDateErr(c => c + 1); } else { setRecDate(e.target.value); } },
                  style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: FONTS.sub.size },
                })}
              </View>
            </View>
            <DateErrorHint trigger={recDateErr} message={t('errDateFuture')} color={colors.danger} />

            <View style={st.row2}>
              <View style={st.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: -1 }] }}><Rect x="2" y="4" width="20" height="16" rx="2"/><Path d="M2 10h20"/><Rect x="5" y="14" width="3" height="2" rx="0.5"/></Svg><Text style={st.inputLabel}>{t('cardBalance')}</Text></View>
                <InputWithFocus inputStyle={st.input}
                  value={cardBalance} onChangeText={(v: string) => setCardBalance(blockNeg(v))}
                  onBlur={() => { if (cardBalance !== '') setCardBalance(toDec2(cardBalance)); }}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor={colors.textSub} />
              </View>
              <View style={st.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: -1 }] }}><Rect x="2" y="5" width="20" height="14" rx="2"/><Circle cx="12" cy="12" r="2.5"/><Path d="M18.5 9l-1 0M18.5 15l-1 0M5.5 9l1 0M5.5 15l1 0"/></Svg><Text style={st.inputLabel}>{t('cashBalance')}</Text></View>
                <InputWithFocus inputStyle={st.input}
                  value={cashBalance} onChangeText={(v: string) => setCashBalance(blockNeg(v))}
                  onBlur={() => { if (cashBalance !== '') setCashBalance(toDec2(cashBalance)); }}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor={colors.textSub} />
              </View>
            </View>

            {/* 在途资金 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub }}>{t('fundsInTransit')}</Text>
              <NumberTicker value={channelTotal} style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary }} />
            </View>
            <View style={st.channelGrid}>
              {/* Row 1: 堂食 + 美团 + 闪购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('dineIn')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={dineIn} onChangeText={(v: string) => setDineIn(blockNeg(v))}
                    onBlur={() => { if (dineIn !== '') setDineIn(toDec2(dineIn)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('meituan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={meituan} onChangeText={(v: string) => setMeituan(blockNeg(v))}
                    onBlur={() => { if (meituan !== '') setMeituan(toDec2(meituan)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('flashSale')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={flashSale} onChangeText={(v: string) => setFlashSale(blockNeg(v))}
                    onBlur={() => { if (flashSale !== '') setFlashSale(toDec2(flashSale)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
              </View>
              {/* Row 2: 京东 + 团购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('jd')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={jd} onChangeText={(v: string) => setJd(blockNeg(v))}
                    onBlur={() => { if (jd !== '') setJd(toDec2(jd)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('tuan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={tuan} onChangeText={(v: string) => setTuan(blockNeg(v))}
                    onBlur={() => { if (tuan !== '') setTuan(toDec2(tuan)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 按钮行：对账记录(左) + 添加(右) */}
            <View style={st.btnRow}>
              <TouchableOpacity style={st.reconRecordBtn} onPress={onReconHistory} activeOpacity={0.8}>
                <Text style={st.reconRecordBtnText}>{t('reconHistory')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.reconBtn, !hasReconChanges && { opacity: 0.4 }]}
                onPress={() => hasReconChanges && setShowToast(true)}
                activeOpacity={hasReconChanges ? 0.8 : 1}
                disabled={!hasReconChanges}
              >
                <Text style={st.reconBtnText}>{t('reconComplete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>
        )}

        {/* ── 模块三：支出明细 ── */}
        {activeTab === 1 && (
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
                    value={expAmount} onChangeText={(v: string) => setExpAmount(fmtDecInput(v))}
                    onBlur={() => { if (expAmount !== '') setExpAmount(toDec2Comma(expAmount)); }}
                    keyboardType="decimal-pad" placeholder="0.00"
                    placeholderTextColor={colors.textSub}
                    autoFocus={false} />
                </View>
                <View style={st.amtCursor} />
              </View>
              {/* 分类胶囊 */}
              <Text style={st.catSectionTitle}>{t('expenseCategory')}</Text>
              <CategoryChips selected={expCategory} onSelect={setExpCategory} />
              {/* 支付方式 */}
              <Text style={st.catSectionTitle}>{t('paymentMethod')}</Text>
              <PaymentMethodChips selected={payMethod} onSelect={setPayMethod} />
              {/* 支出说明 */}
              <ExpenseNoteInput value={expNote} onChangeText={setExpNote} />
              {/* 凭证上传 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[st.catSectionTitle, { marginBottom: 0 }]}>{t('uploadImage')}</Text>
                <TouchableOpacity onPress={() => setShowImgTip(!showImgTip)} activeOpacity={0.7}
                  style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub }}>!</Text>
                </TouchableOpacity>
                {showImgTip && (
                  <View style={st.imgTipBubble}>
                    <Text style={st.imgTipText}>支持 jpg/png/webp，单张最大 10MB</Text>
                  </View>
                )}
              </View>
              <View style={st.imgRow}>
                {/* Hidden file input */}
                {React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/jpeg,image/png,image/webp',
                  multiple: true,
                  onChange: handleImageSelect,
                  style: { display: 'none' },
                })}
                {/* Add button */}
                <TouchableOpacity style={st.imgAddBtn}
                  onPress={() => fileInputRef.current?.click()}
                  activeOpacity={0.7}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.5} strokeLinecap="round">
                    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <Circle cx="12" cy="13" r="4" />
                  </Svg>
                  <Text style={st.imgAddText}>{t('addImage')}</Text>
                </TouchableOpacity>
                {/* Image previews */}
                {expImages.map((file, i) => (
                  <View key={`img-${i}`} style={st.imgPreview}>
                    {React.createElement('img', {
                      src: getPreviewUrl(file),
                      style: { width: 92, height: 92, borderRadius: 12, objectFit: 'cover' },
                      alt: file.name,
                    })}
                    <TouchableOpacity style={st.imgRemove}
                      onPress={() => removeImage(i)}
                      activeOpacity={0.7}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.surface} strokeWidth={2.5} strokeLinecap="round">
                        <Path d="M18 6L6 18M6 6l12 12" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {/* 日期选择 */}
              <View style={st.expDateRow}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.5}>
                  <Rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <Line x1="16" y1="2" x2="16" y2="6"/>
                  <Line x1="8" y1="2" x2="8" y2="6"/>
                  <Line x1="3" y1="10" x2="21" y2="10"/>
                </Svg>
                <View style={{ flex: 1 }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}
                  >
                    <Text style={st.dateText}>
                      {(() => {
                        const l = getLang();
                        const [y, m, d] = expDate.split('-');
                        if (l.startsWith('en')) {
                          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                          return `${months[+m-1]} ${+d}, ${y}`;
                        }
                        return `${y}年${m}月${d}日`;
                      })()}
                    </Text>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: 0 }] }}><Path d="M10 6l6 6-6 6"/></Svg>
                    {React.createElement('input', {
                      ref: expDateInputRef,
                      type: 'date',
                      defaultValue: expDate,
                      max: todayStr(),
                      onChange: handleExpDateChange,
                      style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: FONTS.sub.size },
                    })}
                  </View>
                  <DateErrorHint trigger={expDateErr} message={t('errDateFuture')} color={colors.danger} textAlign="left" />
                </View>
              </View>
              {/* 按钮行 */}
              <View style={st.btnRow}>
                <TouchableOpacity style={st.reconRecordBtn}
                  onPress={() => onExpenseHistory?.()} activeOpacity={0.8}>
                  <Text style={st.reconRecordBtnText}>{t('expenseHistory')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.expBtn, { flex: 1 }]}
                  onPress={() => { if (parseFloat(expAmount.replace(/,/g, '')) > 0) setShowExpConfirm(true); }}
                  disabled={isAmountInvalid}
                  activeOpacity={0.8}
                >
                  <Text style={st.expBtnText}>
                    {loadingExp ? '...' : t('confirmRecord')}
                  </Text>
                  {isAmountInvalid && (
                    <View style={st.expBtnMask} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </FadeInView>
        )}
      </ScrollView>

      {/* 支出确认弹窗 */}
        <ModalOverlay visible={showExpConfirm} onClose={() => setShowExpConfirm(false)}>
          <View style={st.modalCard} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('expConfirmTitle')}</Text>
              <TouchableOpacity onPress={() => setShowExpConfirm(false)}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center' }}>
                {t('expConfirmMsg')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={st.modalCancelBtn} onPress={() => setShowExpConfirm(false)}>
                  <Text style={st.modalCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalBtn} onPress={() => { setShowExpConfirm(false); handleAddExpense(); }}>
                  <Text style={st.modalBtnText}>{t('confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ModalOverlay>

      {/* 添加提示弹窗 */}
        <ModalOverlay visible={showToast} onClose={hideToast}>
          <View style={st.modalCard} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('friendlyReminder')}</Text>
              <TouchableOpacity onPress={hideToast}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center' }}>
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
        </ModalOverlay>
      {/* Platform fee entry bottom sheet */}
        <ModalOverlay visible={showFeeSheet} onClose={() => setShowFeeSheet(false)}>
          <View style={[st.feeSheet, { maxWidth: 720 }]} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('addFeeEntry')}</Text>
              <TouchableOpacity onPress={() => setShowFeeSheet(false)}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
              {/* Date */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight, marginTop: 2 }}>{t('entryDate')}</Text>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
                    <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub }}>
                      {(() => { return fmtLocalDate(feeEntryDate); })()}
                    </Text>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, transform: [{ translateY: -1 }] }}><Path d="M10 6l6 6-6 6"/></Svg>
                    {React.createElement('input', {
                      ref: feeDateInputRef,
                      type: 'date', defaultValue: feeEntryDate, max: todayStr(),
                      onChange: (e: any) => { if (isFuture(e.target.value)) { feeDateInputRef.current!.value = feeEntryDate; setFeeDateErr(c => c + 1); } else { setFeeEntryDate(e.target.value); } },
                      style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: FONTS.sub.size },
                    })}
                  </View>
                  <DateErrorHint trigger={feeDateErr} message={t('errDateFuture')} color={colors.danger} />
                </View>
              </View>

              {/* Column headers */}
              <View style={{ flexDirection: 'row', marginBottom: 10, gap: 6, paddingHorizontal: 2 }}>
                <Text style={{ flex: 1, minWidth: 100, maxWidth: 220, flexShrink: 1, fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight }}></Text>
                <Text style={{ width: 80, fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight, textAlign: 'left' }}>{t('feePreview')}</Text>
                <Text style={{ width: 80, fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight, textAlign: 'left' }}>{t('feeCurrent')}</Text>
                <Text style={{ width: 76, fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight, textAlign: 'right' }}>{t('feeEntry')}</Text>
              </View>

              {/* Fee rows */}
              {([
                { k: 'meituanCashier', cur: feeData?.meituan_cashier || 0, val: feeMc, set: setFeeMc },
                { k: 'meituanWaimai', cur: feeData?.meituan_waimai || 0, val: feeMw, set: setFeeMw },
                { k: 'shangouWaimai', cur: feeData?.shangou_waimai || 0, val: feeEw, set: setFeeEw },
                { k: 'meituanTuan', cur: feeData?.meituan_tuan || 0, val: feeMt, set: setFeeMt },
              ] as const).map((row) => {
                const inputNum = toNum(row.val);
                return (
                  <View key={row.k} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 6 }}>
                    <Text style={{ flex: 1, minWidth: 100, maxWidth: 220, flexShrink: 1, fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight, marginTop: 8 }}>{t(row.k)}</Text>
                    <Text style={{ width: 80, fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain, textAlign: 'left', marginTop: 8 }}>
                      ¥{(row.cur + inputNum).toFixed(2)}
                    </Text>
                    <Text style={{ width: 80, fontSize: FONTS.micro.size, color: colors.textSub, textAlign: 'left', marginTop: 10 }}>
                      ¥{row.cur.toFixed(2)}
                    </Text>
                    <TextInput
                      style={{ width: 76, height: 38, borderWidth: 1, borderColor: colors.secondary, borderRadius: 8, paddingHorizontal: 10, fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub, textAlign: 'right', backgroundColor: colors.surface, outline: 'none' } as any}
                      value={row.val} onChangeText={(v: string) => row.set(fmtDecInput(v))}
                      keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSub}
                    />
                  </View>
                );
              })}

              {/* Confirm */}
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, opacity: (savingFee || (toNum(feeMc) + toNum(feeMw) + toNum(feeEw) + toNum(feeMt) === 0)) ? 0.35 : 1 }}
                onPress={handleAddFee} disabled={savingFee || (toNum(feeMc) + toNum(feeMw) + toNum(feeEw) + toNum(feeMt) === 0)} activeOpacity={0.8}
              >
                <Text style={{ color: colors.surface, fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight }}>{savingFee ? '...' : t('confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModalOverlay>

      {/* Fee history bottom sheet — "全部" detail view */}
        <ModalOverlay visible={showFeeHistory} onClose={() => { setShowFeeHistory(false); setFeeHistoryFilter('all'); }}>
          <View style={[st.feeSheet, { height: Dimensions.get('window').height * 0.75, width: '96%' }]} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('feeHistory')}</Text>
              <TouchableOpacity onPress={() => { setShowFeeHistory(false); setFeeHistoryFilter('all'); }}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Month filter */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                ref={feeHistoryFilterTriggerRef}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, position: 'relative' }}
                onPress={() => {
                  if (!showFeeHistoryFilterPicker) {
                    if (feeHistoryFilterTriggerRef.current && typeof (feeHistoryFilterTriggerRef.current as any).measure === 'function') {
                      (feeHistoryFilterTriggerRef.current as any).measure((_x: number, _y: number, _w: number, _h: number, px: number, py: number) => {
                        setFeeHistoryPickerPos({ top: py + 30, left: px });
                      });
                    }
                    pickerAnim.setValue(0);
                    Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
                    setShowFeeHistoryFilterPicker(true);
                  } else {
                    Animated.timing(pickerAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                      setShowFeeHistoryFilterPicker(false);
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: FONTS.subBold.size, color: colors.primary, fontWeight: FONTS.subBold.weight }}>
                  {feeHistoryFilter === 'all' ? t('feeAllMonths') : fmtMonth(feeHistoryFilter.year, feeHistoryFilter.month)}
                </Text>
                <Text style={{ fontSize: FONTS.micro.size, color: colors.primary, marginLeft: 2 }}>▼</Text>

              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {(feeHistoryFilter === 'all' ? allFees : allFees.filter((f: any) => f.year === feeHistoryFilter.year && f.month === feeHistoryFilter.month)).map((f: any, idx: number) => {
                const monthTotal = (f.meituan_cashier || 0) + (f.meituan_waimai || 0) + (f.shangou_waimai || 0) + (f.meituan_tuan || 0);
                const platforms = [
                  { label: t('meituanCashier'), value: f.meituan_cashier || 0, color: colors.info },
                  { label: t('meituanWaimai'), value: f.meituan_waimai || 0, color: colors.warning },
                  { label: t('shangouWaimai'), value: f.shangou_waimai || 0, color: colors.info },
                  { label: t('meituanTuan'), value: f.meituan_tuan || 0, color: colors.success },
                ];
                return (
                  <View key={f.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.secondary, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } as any}>
                    {/* Header: date + total */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <Text style={{ fontSize: FONTS.subBold.size, color: colors.textSub, fontWeight: FONTS.subBold.weight }}>{fmtMonth(f.year, f.month)}</Text>
                      <Text style={{ fontSize: FONTS.body.size, color: colors.primary, fontWeight: FONTS.h2.weight }}>¥{monthTotal.toFixed(2)}</Text>
                    </View>
                    {/* Sub items: 2x2 grid of platform fees */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {platforms.map((p) => (
                        <View key={p.label} style={{ flex: 1, minWidth: '46%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, gap: 6 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.color }} />
                          <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, flex: 1 }}>{p.label}</Text>
                          <Text style={{ fontSize: FONTS.microBold.size, color: colors.textMain, fontWeight: FONTS.microBold.weight }}>¥{p.value.toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ModalOverlay>
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
      {/* Month picker dropdown — animated spring popover */}
      {showFeeMonthPicker && (
        <>
          {/* Animated backdrop */}
          <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998, opacity: pickerAnim }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeMonthPicker(false));
              }}
            />
          </Animated.View>
          <Animated.View style={{
            position: 'fixed' as any,
            top: pickerPos.top || '38%',
            left: pickerPos.left || 10,
            zIndex: 9999,
            backgroundColor: colors.surface,
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            paddingVertical: 6,
            width: 140,
            maxHeight: 240,
            overflow: 'scroll' as any,
            opacity: pickerAnim,
            transform: [{ scale: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' }) }, { translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) }],
          }}>
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: feeMonth === 'all' ? withAlpha(colors.danger, 0.1) : 'transparent', borderRadius: 8, marginHorizontal: 4 }}
              onPress={() => {
                setFeeMonth('all');
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeMonthPicker(false));
              }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: feeMonth === 'all' ? '700' : '500', color: feeMonth === 'all' ? colors.primary : colors.textMain }}>{t('feeAllMonths')}</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.secondary, marginHorizontal: 12, marginVertical: 4 }} />
            {[...allFees].filter((f: any) => f.year > 2024 || (f.year === 2024 && f.month >= 5)).sort((a: any, b: any) => (b.year - a.year) || (b.month - a.month)).map((f: any) => {
              const isSel = feeMonth !== 'all' && feeMonth.year === f.year && feeMonth.month === f.month;
              return (
                <TouchableOpacity
                  key={`${f.year}-${f.month}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: isSel ? withAlpha(colors.danger, 0.1) : 'transparent', borderRadius: 8, marginHorizontal: 4 }}
                  onPress={() => {
                    setFeeMonth({ year: f.year, month: f.month });
                    Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeMonthPicker(false));
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: FONTS.sub.size, fontWeight: isSel ? '700' : '400', color: isSel ? colors.primary : colors.textMain }}>{fmtMonth(f.year, f.month)}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}
      {/* Fee history filter dropdown — animated to match platform fee picker */}
      {showFeeHistoryFilterPicker && (
        <>
          <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998, opacity: pickerAnim }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeHistoryFilterPicker(false));
              }}
            />
          </Animated.View>
          <Animated.View style={{
            position: 'fixed' as any,
            top: feeHistoryPickerPos.top || '38%',
            left: feeHistoryPickerPos.left || 10,
            zIndex: 9999,
            backgroundColor: colors.surface,
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            paddingVertical: 6,
            width: 140,
            maxHeight: 240,
            overflow: 'scroll' as any,
            opacity: pickerAnim,
            transform: [{ scale: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' }) }, { translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) }],
          }}>
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: feeHistoryFilter === 'all' ? withAlpha(colors.danger, 0.1) : 'transparent', borderRadius: 8, marginHorizontal: 4 }}
              onPress={() => {
                setFeeHistoryFilter('all');
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeHistoryFilterPicker(false));
              }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: feeHistoryFilter === 'all' ? '700' : '500', color: feeHistoryFilter === 'all' ? colors.primary : colors.textMain }}>{t('feeAllMonths')}</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.secondary, marginHorizontal: 12, marginVertical: 4 }} />
            {[...allFees].filter((f: any) => f.year > 2024 || (f.year === 2024 && f.month >= 5)).sort((a: any, b: any) => (b.year - a.year) || (b.month - a.month)).map((f: any) => {
              const isSel = feeHistoryFilter !== 'all' && feeHistoryFilter.year === f.year && feeHistoryFilter.month === f.month;
              return (
                <TouchableOpacity
                  key={`hf-${f.year}-${f.month}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: isSel ? withAlpha(colors.danger, 0.1) : 'transparent', borderRadius: 8, marginHorizontal: 4 }}
                  onPress={() => {
                    setFeeHistoryFilter({ year: f.year, month: f.month });
                    Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowFeeHistoryFilterPicker(false));
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: FONTS.sub.size, fontWeight: isSel ? '700' : '400', color: isSel ? colors.primary : colors.textMain }}>{fmtMonth(f.year, f.month)}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════ STYLES ═══════════════════════════════════ */
const getSt = (colors: ThemeColors) => StyleSheet.create({
  ...uploadReceiptStyles(colors),
  root: { flex: 1 },

  /* ── Tab Bar ── */
  tabBar: {
    paddingTop: 4, paddingBottom: 8,
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
    width: 'calc(100vw - 61px)', height: 210,
    // @ts-ignore — 极透磨砂玻璃：渐变色在 render 中动态设置
    backgroundImage: `linear-gradient(90deg, ${withAlpha(colors.primary, 0.22)} 0%, ${withAlpha(colors.info, 0.22)} 100%)`,
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
    fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: 'rgba(255,255,255,0.95)',
    alignSelf: 'flex-start',
    // @ts-ignore
    textShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  tabTitleActive: {
    color: colors.surface, fontWeight: FONTS.amount.weight,
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
    fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: 'rgba(255,255,255,0.70)',
    // @ts-ignore
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  cardFieldVal: {
    fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: 'rgba(255,255,255,0.95)',
    // @ts-ignore
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  totalExpLabel: {
    fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: 'rgba(255,255,255,0.70)',
    textAlign: 'center', marginBottom: 6,
  },
  totalExpVal: {
    fontSize: FONTS.h1.size, fontWeight: FONTS.amount.weight, color: 'rgba(255,255,255,0.95)',
  },
  tabStat: {
    fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, letterSpacing: -0.5,
    color: colors.surface,
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },

  /* ── Content ── */
  contentScroll: { flex: 1 },
  contentInner: {
    paddingHorizontal: 0, paddingBottom: 100, gap: 0,
  },
  moduleWrap: {
    width: '100%',
  },

  /* ── Content Card (glass) ── */
  card: {
    borderRadius: 14,
    paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12,
    gap: 14,
    backgroundColor: colors.bg,
    borderWidth: 0.5, borderColor: colors.secondary,
    // @ts-ignore
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },

  /* ── Date ── */
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText: {
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub,
    fontFamily: undefined,
  },
  dateInput: {
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub,
    borderWidth: 0, padding: 0, margin: 0,
    backgroundColor: 'transparent', fontFamily: 'inherit',
    // @ts-ignore
    outline: 'none',
    // @ts-ignore — native date picker icon
    WebkitAppearance: 'none',
  } as any,

  /* ── Labels ── */
  sectionLabel: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  subLabel: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, letterSpacing: 0.5, textTransform: 'uppercase' },

  /* ── Inputs ── */
  row2: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: FONTS.micro.size, lineHeight: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.secondary,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12,
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub, fontFamily: undefined,
    // @ts-ignore
    outline: 'none',
  },

  /* ── Channel grid ── */
  channelGrid: {
    flexDirection: 'column', gap: 8,
  },
  channelChip: {
    flex: 1, minWidth: 60,
    backgroundColor: colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: colors.secondary,
    paddingVertical: 4, paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  chipLabel: {
    fontSize: FONTS.microBold.size, color: colors.textSub, fontWeight: FONTS.microBold.weight,
  },
  chipInput: {
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub,
    textAlign: 'center', paddingVertical: 2,
    fontFamily: undefined,
    width: '100%',
    borderWidth: 0, backgroundColor: 'transparent',
    // @ts-ignore
    outline: 'none',
  },

  /* ── Sum row ── */
  sumRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  sumLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  sumVal: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },

  /* ── Result bar ── */
  resultBar: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 14, padding: 16,
    alignItems: 'center',
  },
  resultItem: { flex: 1, alignItems: 'center' },
  resultDivider: { width: 1, height: 32, backgroundColor: colors.secondary },
  resultLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 4 },
  resultVal: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  resultDiff: { fontSize: FONTS.h1.size, fontWeight: FONTS.amount.weight, letterSpacing: -0.5 },
  /* ── Recon buttons ── */
  btnRow: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  reconBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  reconBtnText: {
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface,
  },
  reconRecordBtn: {
    flex: 1, backgroundColor: colors.secondary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.secondary,
  },
  reconRecordBtnText: {
    fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub,
  },

  /* ── KPI ── */
  kpiRow: { flexDirection: 'column' },
  kpiItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  kpiDivider: { height: 1, backgroundColor: colors.secondary, marginHorizontal: 4 },
  kpiLabel: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight },
  kpiVal: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },

  /* ── Table ── */
  tableWrap: {
    borderWidth: 1, borderColor: colors.secondary, borderRadius: 12, overflow: 'hidden',
  },
  tableHead: { backgroundColor: colors.bg },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.secondary,
  },
  td: { paddingVertical: 10, paddingHorizontal: 10, fontSize: FONTS.micro.size, color: colors.textSub },
  tdDate: { width: 90, color: colors.textSub, fontSize: FONTS.micro.size },
  tdCat: { flex: 1 },
  tdAmt: { width: 100, textAlign: 'right', fontWeight: FONTS.microBold.weight },

  /* ── Date row ── */
  expDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bg, borderRadius: 10,
    paddingVertical: 12, paddingRight: 12,
  },
  expDateInput: {
    fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub,
    borderWidth: 0, padding: 0, backgroundColor: 'transparent',
    // @ts-ignore
    outline: 'none',
  },

  /* ── Expense form ── */
  expForm: { gap: 14 },
  /* Big amount input */
  bigAmtWrap: { alignItems: 'center', paddingVertical: 16 },
  bigAmtLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 8 },
  bigAmtRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bigAmtSymbol: { fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: colors.primary, marginRight: 6 },
  bigAmtInput: {
    fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: colors.textMain,
    borderWidth: 0, backgroundColor: 'transparent',
    textAlign: 'left', padding: 0,
    flex: 0, width: 180,
    // @ts-ignore
    outline: 'none',
  },
  amtCursor: {
    width: 40, height: 2, backgroundColor: colors.primary,
    marginTop: 10, borderRadius: 1,
  },
  /* Category chips */
  catSectionTitle: { fontSize: 14, color: colors.textSub, fontWeight: FONTS.microBold.weight, marginBottom: 10 },
  expFormRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  expCatLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  expBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', position: 'relative', overflow: 'hidden',
  },
  expBtnMask: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12,
  },
  expBtnText: { color: colors.surface, fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight },

  /* ── Expense list ── */
  expRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.secondary,
  },
  expNote: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight },
  expDateText: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
  expAmt: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.danger },

  /* ── Empty ── */
  empty: {
    fontSize: FONTS.micro.size, color: colors.textSub, textAlign: 'center', paddingVertical: 24,
  },

  /* ── Modal ── */
  modalOverlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: withAlpha(colors.textMain, 0.4),
  },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: 20, width: 320, maxWidth: '100%',
    overflow: 'hidden',
    // @ts-ignore
    ...modalCardAnimation,
    // @ts-ignore
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
  },
  modalHeader: {
    backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  modalClose: { ...modalClose, },
  modalBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 10, alignItems: 'center',
  },
  modalBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.surface },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 14,
    paddingVertical: 10, alignItems: 'center',
  },
  modalCancelText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
  /* Platform fee sheet — bottom half-screen */
  feeSheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 0,
    // @ts-ignore
    display: 'flex', flexDirection: 'column',
    width: '96%', maxWidth: 500,
    // @ts-ignore
    ...modalCardAnimation,
    // @ts-ignore
    boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
  },
});
