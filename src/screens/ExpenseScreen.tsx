import { useDisclosure } from '../hooks/useDisclosure';
import { useDateField } from '../hooks/useDateField';
import { createPortal } from 'react-dom';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Animated, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';
import ModalOverlay from '../components/ModalOverlay';
import NumberTicker from '../components/NumberTicker';
import FadeInView from '../components/FadeInView';
import DateErrorHint from '../components/DateErrorHint';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { uploadReceiptStyles } from '../sharedStyles';
import { fmtAmt as fmt, fmtAmtFull } from '../utils/format';
import { blockNeg, toDec2, toDec2Comma } from '../utils/numbers';
import { getCurrentUser } from '../utils/storage';
import { useExpenseForm } from './expense/useExpenseForm';
import DatePicker from '../components/DatePicker';
import { useServerDate } from '../hooks/useServerDate';
import CategoryChips from '../components/CategoryChips';
import ButtonPair from '../components/ButtonPair';
import CloseButton from '../components/CloseButton';
import PaymentMethodChips from '../components/PaymentMethodChips';
import ExpenseNoteInput from '../components/ExpenseNoteInput';
import ReceiptUpload from '../components/ReceiptUpload';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

/* ── helpers ── */
// Date helpers replaced by useServerDate() hook (server time, not client)
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
  const sd = useServerDate();
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
  const loadBusinessSummary = useCallback(() => {
    api.getBusinessSummary().then((data: any) => {
      setBusinessSummary(data || {});
    }).catch(() => {});
  }, []);
  useEffect(() => { loadBusinessSummary(); }, [loadBusinessSummary]);

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
  const recDate = useDateField({ sd, initial: '' });
  const [toast, setToast] = useState('');
  const [businessSummary, setBusinessSummary] = useState<any>({});
  const [reconForm, setReconForm] = useState({
    cardBalance: '', cashBalance: '', dineIn: '', meituan: '',
    flashSale: '', tuan: '', jd: '',
  });
  const updateRecon = (k: keyof typeof reconForm, v: string) =>
    setReconForm(f => ({ ...f, [k]: v }));
  const { cardBalance, cashBalance, dineIn, meituan, flashSale, tuan, jd } = reconForm;

  const initReconValues = useRef({ card: '', cash: '', dine: '', mt: '', fs: '', jd: '', tuan: '' });
  const reconJustLoaded = useRef(false);
  const reconLoadId = useRef(0);  // guard against stale async responses
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Load reconciliation data from backend
  // Rule:
  //   1. Exact match on bill_date → show that record's values
  //   2. No match + recDate >= last bill_date → fill with last record's values
  //   3. No match + recDate < last bill_date → leave empty
  useEffect(() => {
    (async () => {
      const id = ++reconLoadId.current;
      try {
        const data = await api.getReconciliations(365);
        if (id !== reconLoadId.current) return; // stale
        if (!data || data.length === 0) {
          updateRecon('cardBalance', ''); updateRecon('cashBalance', '');
          updateRecon('dineIn', ''); updateRecon('meituan', '');
          updateRecon('flashSale', ''); updateRecon('tuan', ''); updateRecon('jd', '');
          reconJustLoaded.current = true;
          return;
        }
        const last = data[0]; // most recent record
        const match = data.find((r: any) => r.bill_date === recDate.value);
        if (match) {
          updateRecon('cardBalance', toDec2(match.card_balance));
          updateRecon('cashBalance', toDec2(match.cash_balance));
          updateRecon('dineIn', toDec2(match.dine_in));
          updateRecon('meituan', toDec2(match.meituan));
          updateRecon('flashSale', toDec2(match.flash_sale));
          updateRecon('tuan', toDec2(match.tuan));
          updateRecon('jd', toDec2(match.jd));
        } else if (recDate.value >= (last.bill_date || '')) {
          updateRecon('cardBalance', toDec2(last.card_balance));
          updateRecon('cashBalance', toDec2(last.cash_balance));
          updateRecon('dineIn', toDec2(last.dine_in));
          updateRecon('meituan', toDec2(last.meituan));
          updateRecon('flashSale', toDec2(last.flash_sale));
          updateRecon('tuan', toDec2(last.tuan));
          updateRecon('jd', toDec2(last.jd));
        } else {
          updateRecon('cardBalance', ''); updateRecon('cashBalance', '');
          updateRecon('dineIn', ''); updateRecon('meituan', '');
          updateRecon('flashSale', ''); updateRecon('tuan', ''); updateRecon('jd', '');
        }
        reconJustLoaded.current = true;
      } catch { setToast(t('toastLoadFailed')); }
    })();
  }, [recDate.value]);

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
    if (sd.ready && sd.isFuture(recDate.value)) { setToast(t('errDateFuture')); return; }
    try {
      const username = getCurrentUser();
      await api.createReconciliation({
        bill_date: recDate.value,
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
  }, [recDate.value, cardBalance, cashBalance, dineIn, meituan, flashSale, tuan, jd, onReconHistory]);

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

  // thisYear/thisMonth replaced by sd.year/sd.month from server time

  const [feeData, setFeeData] = useState<any>(null);        // current month
  const [allFees, setAllFees] = useState<any[]>([]);         // all months for detail
  const [feeMonth, setFeeMonth] = useState<'all' | { year: number; month: number }>('all');
  const feeMonthInited = useRef(false);
  const feeLoadId = useRef(0);  // guard against stale async responses
  useEffect(() => { if (sd.ready && !feeMonthInited.current) { feeMonthInited.current = true; setFeeMonth({ year: sd.year, month: sd.month }); } }, [sd.ready, sd.year, sd.month]);
  const feeMonthPicker = useDisclosure(false);
  const feeSheet = useDisclosure(false);
  const feeHistory = useDisclosure(false);
  const [feeHistoryFilter, setFeeHistoryFilter] = useState<'all' | { year: number; month: number }>('all');
  const feeHistoryFilterPicker = useDisclosure(false);
  const feeDate = useDateField({ sd, initial: '' });
  // Default to today's date once server date is ready
  useEffect(() => { if (sd.ready && sd.today) feeDate.setValue(sd.today); }, [sd.ready]);
  const [feeForm, setFeeForm] = useState({
    feeMc: '', feeMw: '', feeEw: '', feeMt: '',
  });
  const updateFee = (k: keyof typeof feeForm, v: string) =>
    setFeeForm(f => ({ ...f, [k]: v }));
  const { feeMc, feeMw, feeEw, feeMt } = feeForm;
  const [savingFee, setSavingFee] = useState(false);
  const pickerTriggerRef = useRef<any>(null);
  const feeHistoryFilterTriggerRef = useRef<any>(null);
  const [pickerAnim] = useState(new Animated.Value(0));
  const [feeHistoryPickerAnim] = useState(new Animated.Value(0));
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [feeHistoryPickerPos, setFeeHistoryPickerPos] = useState({ top: 0, left: 0 });

  const loadFeeData = async () => {
    const id = ++feeLoadId.current;
    try {
      const all = await api.getPlatformFees();
      if (id !== feeLoadId.current) return; // stale
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
    if (sd.isFuture(feeDate.value)) { setToast(t('errDateFuture')); return; }
    const mc = toNum(feeMc), mw = toNum(feeMw), ew = toNum(feeEw), mt = toNum(feeMt);
    if (mc + mw + ew + mt === 0) { setToast(t('atLeastOneFee')); return; }
    setSavingFee(true);
    try {
      const r = await api.addPlatformFeeEntry({
        year: feeMonth.year, month: feeMonth.month,
        entry_date: feeDate.value,
        meituan_cashier: mc, meituan_waimai: mw,
        shangou_waimai: ew, meituan_tuan: mt,
      });
      if (r?.status === 'ok') {
        setFeeData(r?.data);
        setFeeForm({ feeMc: '', feeMw: '', feeEw: '', feeMt: '' });
        feeSheet.hide();
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
    loadingExp,
    showExpConfirm, setShowExpConfirm,
    handleAddExpense,
    handleImageSelect, removeImage,
    isAmountInvalid,
    fmtDecInput, fmtRefundInput,
    isRefund, setIsRefund,
  } = useExpenseForm({
    onExpenseHistory,
    getPreviewUrl,
    revokePreviewUrl,
    clearUrlCache,
    fileInputRef,
    expDateInputRef,
    onToast: setToast,
    onExpenseAdded: loadBusinessSummary,
  });

  // Sync uncontrolled date inputs when state changes externally
  const recDateInputRef = useRef<HTMLInputElement>(null);
  const feeDateInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (recDateInputRef.current) recDateInputRef.current.value = recDate.value; }, [recDate.value]);
  useEffect(() => { if (expDateInputRef.current) expDateInputRef.current.value = expDate; }, [expDate]);
  useEffect(() => { if (feeDateInputRef.current) feeDateInputRef.current.value = feeDate.value; }, [feeDate.value]);

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

  // Fast glass-card totals from business-summary API
  const glassCatTotals = useMemo(() => ({
    daily: businessSummary.expense_by_category?.daily ?? 0,
    rent: businessSummary.expense_by_category?.rent ?? 0,
    salary: businessSummary.expense_by_category?.salary ?? 0,
    goods: businessSummary.expense_by_category?.goods ?? 0,
  }), [businessSummary.expense_by_category]);

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
                    {tab.title}{i === 1 ? ' ' : ''}
                    {i === 1 && (
                      <Text style={{ color: colors.primary }}>{'¥' + toDec2Comma(businessSummary.cumulative_expense || 0)}</Text>
                    )}
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
                            color: (Math.abs(diff) < 0.005 ? colors.textMain : colors.primary),
                            textShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          } as any}>{diff >= 0 ? '+' : '-'}¥</Text>
                          {/* @ts-ignore */}
                          <Text style={{
                            fontSize: FONTS.h1.size + 4, fontWeight: FONTS.h1.weight,
                            color: (Math.abs(diff) < 0.005 ? colors.textMain : colors.primary),
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
                  <View style={{ transform: [{ translateY: -4 }] }}>
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
                        }}>{'¥' + toDec2Comma(glassCatTotals.daily)}</Text>
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
                        }}>{'¥' + toDec2Comma(glassCatTotals.goods)}</Text>
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
                        }}>{'¥' + toDec2Comma(glassCatTotals.rent)}</Text>
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
                        }}>{'¥' + toDec2Comma(glassCatTotals.salary)}</Text>
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
                    if (!feeMonthPicker.open) {
                      // Measure trigger position for dropdown placement
                      if (pickerTriggerRef.current && typeof (pickerTriggerRef.current as any).measure === 'function') {
                        (pickerTriggerRef.current as any).measure((_x: number, _y: number, _w: number, _h: number, px: number, py: number) => {
                          setPickerPos({ top: py + 30, left: px });
                        });
                      }
                      pickerAnim.setValue(0);
                      Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
                      feeMonthPicker.show();
                    } else {
                      Animated.timing(pickerAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                        feeMonthPicker.hide();
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: FONTS.microBold.size, color: colors.primary, fontWeight: FONTS.microBold.weight }}>
                    {feeMonth === 'all' ? t('feeAllMonths') : fmtMonth(feeMonth.year, feeMonth.month)}
                  </Text>
                  <Svg width={14} height={14} viewBox="0 0 1024 1024" style={{ marginLeft: 2 }}>
                    <Path d="M836.899 399.237l-218.01 335.037c-47.506 73.007-166.272 73.007-213.778 0l-218.01-335.037C139.595 326.23 198.977 234.97 293.99 234.97h436.02c95.013 0 154.395 91.26 106.889 164.267z" fill={colors.primary} />
                  </Svg>
                </TouchableOpacity>
              </View>
              {(feeMonth !== 'all' || allFees.length > 0) && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                onPress={() => {
                  if (feeMonth === 'all') {
                    feeHistory.show(); setFeeHistoryFilter('all');
                  } else {
                    setFeeForm({ feeMc: '', feeMw: '', feeEw: '', feeMt: '' });
                    feeDate.setError(0); loadFeeData(); feeSheet.show();
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
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <DatePicker
                  date={recDate.value}
                  onChange={recDate.setValue}
                  max={sd.today}
                  onFutureDate={() => recDate.setError(Date.now())}
                  displayDate={(() => {
                    const l = getLang();
                    const [y, m, d] = recDate.value.split('-');
                    if (l.startsWith('en')) {
                      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                      return `${months[+m-1]} ${+d}, ${y}`;
                    }
                    return `${y}年${m}月${d}日`;
                  })()}
                  fontSize={FONTS.subBold.size}
                  showCalendarIcon
                  showChevron
                />
              </View>
            </View>
            <DateErrorHint trigger={recDate.error} message={t('errDateFuture')} color={colors.danger} />

            <View style={st.row2}>
              <View style={st.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: -1 }] }}><Rect x="2" y="4" width="20" height="16" rx="2"/><Path d="M2 10h20"/><Rect x="5" y="14" width="3" height="2" rx="0.5"/></Svg><Text style={st.inputLabel}>{t('cardBalance')}</Text></View>
                <InputWithFocus inputStyle={st.input}
                  value={cardBalance} onChangeText={(v: string) => updateRecon('cardBalance', blockNeg(v))}
                  onBlur={() => { if (cardBalance !== '') updateRecon('cardBalance', toDec2(cardBalance)); }}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor={colors.textSub} />
              </View>
              <View style={st.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: -1 }] }}><Rect x="2" y="5" width="20" height="14" rx="2"/><Circle cx="12" cy="12" r="2.5"/><Path d="M18.5 9l-1 0M18.5 15l-1 0M5.5 9l1 0M5.5 15l1 0"/></Svg><Text style={st.inputLabel}>{t('cashBalance')}</Text></View>
                <InputWithFocus inputStyle={st.input}
                  value={cashBalance} onChangeText={(v: string) => updateRecon('cashBalance', blockNeg(v))}
                  onBlur={() => { if (cashBalance !== '') updateRecon('cashBalance', toDec2(cashBalance)); }}
                  keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor={colors.textSub} />
              </View>
            </View>

            {/* 在途资金 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub }}>{t('fundsInTransit')}</Text>
              <NumberTicker value={channelTotal} formatFn={fmtAmtFull} style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary }} />
            </View>
            <View style={st.channelGrid}>
              {/* Row 1: 堂食 + 美团 + 闪购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('dineIn')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={dineIn} onChangeText={(v: string) => updateRecon('dineIn', blockNeg(v))}
                    onBlur={() => { if (dineIn !== '') updateRecon('dineIn', toDec2(dineIn)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('meituan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={meituan} onChangeText={(v: string) => updateRecon('meituan', blockNeg(v))}
                    onBlur={() => { if (meituan !== '') updateRecon('meituan', toDec2(meituan)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('flashSale')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={flashSale} onChangeText={(v: string) => updateRecon('flashSale', blockNeg(v))}
                    onBlur={() => { if (flashSale !== '') updateRecon('flashSale', toDec2(flashSale)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
              </View>
              {/* Row 2: 京东 + 团购 */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('jd')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={jd} onChangeText={(v: string) => updateRecon('jd', blockNeg(v))}
                    onBlur={() => { if (jd !== '') updateRecon('jd', toDec2(jd)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.channelChip, { flex: 1 }]} activeOpacity={1}>
                  <Text style={st.chipLabel}>{t('tuan')}</Text>
                  <InputWithFocus inputStyle={st.chipInput}
                    value={tuan} onChangeText={(v: string) => updateRecon('tuan', blockNeg(v))}
                    onBlur={() => { if (tuan !== '') updateRecon('tuan', toDec2(tuan)); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00" placeholderTextColor={colors.textSub} />
                </TouchableOpacity>
              </View>
            </View>

            <ButtonPair
              leftLabel={t('reconHistory')}
              leftOnPress={onReconHistory}
              rightLabel={t('reconComplete')}
              rightOnPress={() => hasReconChanges && setShowToast(true)}
              rightDisabled={!hasReconChanges}
            />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6 }}>
                  <Text style={st.bigAmtLabel}>{isRefund ? t('refundAmount') : t('amountLabel')}</Text>
                  <TouchableOpacity
                    onPress={() => { setIsRefund(!isRefund); if (!isRefund) setExpAmount(''); }}
                    activeOpacity={0.7}
                    style={{
                      padding: 2, borderRadius: 4, marginTop: -7,
                      backgroundColor: isRefund ? withAlpha(colors.danger, 0.1) : withAlpha(colors.textMain, 0.06),
                    }}
                  >
                    <Svg width={18} height={18} viewBox="0 0 1024 1024">
                      <Path d="M941 512c0 229.2-185.8 415-415 415S111 741.2 111 512 296.8 97 526 97c22.9 0 41.5 18.6 41.5 41.5S548.9 180 526 180c-183.4 0-332 148.6-332 332s148.6 332 332 332 332-148.6 332-332c0-22.9 18.6-41.5 41.5-41.5S941 489.1 941 512z m-356.3-83.2h65.8c22.9 0 41.5 18.6 41.5 41.5s-18.6 41.5-41.5 41.5h-83v41.5h83c22.9 0 41.5 18.6 41.5 41.5s-18.6 41.5-41.5 41.5h-83v83c0 22.9-18.6 41.5-41.5 41.5s-41.5-18.6-41.5-41.5v-83h-83c-22.9 0-41.5-18.6-41.5-41.5s18.6-41.5 41.5-41.5h83v-41.5h-83c-22.9 0-41.5-18.6-41.5-41.5s18.6-41.5 41.5-41.5h65.8L396.5 358c-16.2-16.2-16.2-42.5 0-58.7s42.5-16.2 58.7 0l70.8 70.8 70.8-70.8c16.2-16.2 42.5-16.2 58.7 0 16.2 16.2 16.2 42.5 0 58.7l-70.8 70.8z" fill={isRefund ? colors.danger : colors.textSub} />
                      <Path d="M853.4 243.7l-88 88c-16.2 16.2-42.5 16.2-58.7 0s-16.2-42.5 0-58.7l88-88-88-88h234.8v234.8l-88.1-88.1z" fill={isRefund ? colors.danger : colors.textSub} />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <View style={[st.bigAmtRow, isRefund && { borderColor: withAlpha(colors.danger, 0.3) }]}>
                  {isRefund ? (
                    <Text style={[st.bigAmtSymbol, { color: colors.danger }]}>+</Text>
                  ) : (
                    <Text style={st.bigAmtSymbol}>-</Text>
                  )}
                  <Text style={st.bigAmtSymbol}>¥</Text>
                  <TextInput style={st.bigAmtInput}
                    value={expAmount} onChangeText={(v: string) => setExpAmount(fmtRefundInput(v))}
                    onBlur={() => { if (expAmount !== '') setExpAmount(toDec2Comma(expAmount)); }}
                    keyboardType="decimal-pad" placeholder="0.00"
                    placeholderTextColor={colors.textSub}
                    autoFocus={false} />
                </View>
                <View style={st.amtCursor} />
              </View>
              {/* 分类胶囊 */}
              <CategoryChips selected={expCategory} onSelect={setExpCategory} />
              {/* 支付方式 */}
              <PaymentMethodChips selected={payMethod} onSelect={setPayMethod} />
              {/* 支出说明 */}
              <ExpenseNoteInput value={expNote} onChangeText={setExpNote} />
              {/* 凭证上传 */}
              <ReceiptUpload
                newFiles={expImages}
                onAdd={(files: File[]) => handleImageSelect({ target: { files: files as any, value: '' } } as any)}
                onRemoveNew={removeImage}
                getPreviewUrl={getPreviewUrl}
                maxThumbSize={120}
              />
              {/* 日期选择 */}
              <View style={st.expDateRow}>
                <DatePicker
                  date={expDate}
                  onChange={setExpDate}
                  max={sd.today}
                  onFutureDate={() => setExpDateErr(c => c + 1)}
                  displayDate={(() => {
                    const l = getLang();
                    const [y, m, d] = expDate.split('-');
                    if (l.startsWith('en')) {
                      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                      return `${months[+m-1]} ${+d}, ${y}`;
                    }
                    return `${y}年${m}月${d}日`;
                  })()}
                  fontSize={FONTS.subBold.size}
                  showCalendarIcon
                  showChevron
                />
                <DateErrorHint trigger={expDateErr} message={t('errDateFuture')} color={colors.danger} textAlign="left" />
              </View>
              <ButtonPair
                leftLabel={t('expenseHistory')}
                leftOnPress={() => onExpenseHistory?.()}
                rightLabel={loadingExp ? '...' : t('confirmRecord')}
                rightOnPress={() => { if (parseFloat(expAmount.replace(/,/g, '')) !== 0) setShowExpConfirm(true); }}
                rightDisabled={isAmountInvalid}
              />
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
              <CloseButton onPress={() => setShowExpConfirm(false)} />
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center' }}>
                {t('expConfirmMsg')}
              </Text>
              <ButtonPair
                leftLabel={t('cancel')}
                leftOnPress={() => setShowExpConfirm(false)}
                rightLabel={t('confirm')}
                rightOnPress={() => { setShowExpConfirm(false); handleAddExpense(); }}
              />
            </View>
          </View>
        </ModalOverlay>

      {/* 添加提示弹窗 */}
        <ModalOverlay visible={showToast} onClose={hideToast}>
          <View style={st.modalCard} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('friendlyReminder')}</Text>
              <CloseButton onPress={hideToast} />
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center' }}>
                {t('jokeRecon')}
              </Text>
              <ButtonPair
                leftLabel={t('cancel')}
                leftOnPress={hideToast}
                rightLabel={t('confirm')}
                rightOnPress={() => { hideToast(); submitRecon(); }}
              />
            </View>
          </View>
        </ModalOverlay>
      {/* Platform fee entry bottom sheet */}
        <ModalOverlay visible={feeSheet.open} onClose={() => feeSheet.hide()}>
          <View style={[st.feeSheet, { maxWidth: 720 }]} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('addFeeEntry')}</Text>
              <CloseButton onPress={() => feeSheet.hide()} />
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
              {/* Date */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight, marginTop: 2 }}>{t('entryDate')}</Text>
                <View>
                  <DatePicker
                    date={feeDate.value}
                    onChange={feeDate.setValue}
                    max={sd.today}
                    onFutureDate={() => feeDate.setError(Date.now())}
                    displayDate={fmtLocalDate(feeDate.value)}
                    fontSize={FONTS.subBold.size}
                    showCalendarIcon
                    showChevron
                  />
                  <DateErrorHint trigger={feeDate.error} message={t('errDateFuture')} color={colors.danger} />
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
                { k: 'meituanCashier', cur: feeData?.meituan_cashier || 0, val: feeMc, set: (v: string) => updateFee('feeMc', v) },
                { k: 'meituanWaimai', cur: feeData?.meituan_waimai || 0, val: feeMw, set: (v: string) => updateFee('feeMw', v) },
                { k: 'shangouWaimai', cur: feeData?.shangou_waimai || 0, val: feeEw, set: (v: string) => updateFee('feeEw', v) },
                { k: 'meituanTuan', cur: feeData?.meituan_tuan || 0, val: feeMt, set: (v: string) => updateFee('feeMt', v) },
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
        <ModalOverlay visible={feeHistory.open} onClose={() => { feeHistory.hide(); setFeeHistoryFilter('all'); }}>
          <View style={[st.feeSheet, { height: Dimensions.get('window').height * 0.75, width: '96%' }]} onStartShouldSetResponder={() => true}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{t('feeHistory')}</Text>
              <CloseButton onPress={() => { feeHistory.hide(); setFeeHistoryFilter('all'); }} />
            </View>
            {/* Month filter */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                ref={feeHistoryFilterTriggerRef}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, position: 'relative' }}
                onPress={() => {
                  if (!feeHistoryFilterPicker.open) {
                    if (feeHistoryFilterTriggerRef.current) {
                      (feeHistoryFilterTriggerRef.current as any).measureInWindow((x: number, y: number, w: number, h: number) => {
                        setFeeHistoryPickerPos({ top: y + 30, left: x });
                        feeHistoryPickerAnim.setValue(0);
                        Animated.spring(feeHistoryPickerAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
                        feeHistoryFilterPicker.show();
                      });
                    } else {
                      feeHistoryPickerAnim.setValue(0);
                      Animated.spring(feeHistoryPickerAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
                      feeHistoryFilterPicker.show();
                    }
                  } else {
                    Animated.timing(feeHistoryPickerAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                      feeHistoryFilterPicker.hide();
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: FONTS.microBold.size, color: colors.primary, fontWeight: FONTS.microBold.weight }}>
                  {feeHistoryFilter === 'all' ? t('feeAllMonths') : fmtMonth(feeHistoryFilter.year, feeHistoryFilter.month)}
                </Text>
                <Svg width={14} height={14} viewBox="0 0 1024 1024" style={{ marginLeft: 2 }}>
                    <Path d="M836.899 399.237l-218.01 335.037c-47.506 73.007-166.272 73.007-213.778 0l-218.01-335.037C139.595 326.23 198.977 234.97 293.99 234.97h436.02c95.013 0 154.395 91.26 106.889 164.267z" fill={colors.primary} />
                  </Svg>

              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {(feeHistoryFilter === 'all' ? allFees : allFees.filter((f: any) => f.year === feeHistoryFilter.year && f.month === feeHistoryFilter.month)).map((f: any, _idx: number) => {
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
      {feeMonthPicker.open && (
        <>
          {/* Animated backdrop */}
          <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998, opacity: pickerAnim }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeMonthPicker.hide());
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
                Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeMonthPicker.hide());
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
                    Animated.timing(pickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeMonthPicker.hide());
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
      {feeHistoryFilterPicker.open && createPortal(
        <>
          <Animated.View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998, opacity: feeHistoryPickerAnim }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                Animated.timing(feeHistoryPickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeHistoryFilterPicker.hide());
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
            opacity: feeHistoryPickerAnim,
            transform: [{ scale: feeHistoryPickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' }) }, { translateY: feeHistoryPickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) }],
          }}>
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: feeHistoryFilter === 'all' ? withAlpha(colors.danger, 0.1) : 'transparent', borderRadius: 8, marginHorizontal: 4 }}
              onPress={() => {
                setFeeHistoryFilter('all');
                Animated.timing(feeHistoryPickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeHistoryFilterPicker.hide());
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
                    Animated.timing(feeHistoryPickerAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => feeHistoryFilterPicker.hide());
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: FONTS.sub.size, fontWeight: isSel ? '700' : '400', color: isSel ? colors.primary : colors.textMain }}>{fmtMonth(f.year, f.month)}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>,
        document.body,
      )}
    </View>
  );
};

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

    // @ts-ignore
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
  },
  modalHeader: {
    backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
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

    // @ts-ignore
    boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
  },
});
