import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client';
import { t } from '../../i18n';
import { getCurrentUserId } from '../../utils/storage';
import { useServerDate } from '../../hooks/useServerDate';

type Tab = 'list' | 'expense' | 'supply' | 'chart' | 'partner';

export function useHomeData(tab: Tab, setToast: (msg: string) => void) {
  // ── Core data ──
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [chart, setChart] = useState<any[]>([]);
  const [chartMonthly, setChartMonthly] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [businessSummary, setBusinessSummary] = useState<any>({});
  const summaryRef = useRef<any>(null); // avoids batching flash (consistency with iOS)
  const [dailyRevenues, setDailyRevenues] = useState<any[]>([]);
  const [last7Records, setLast7Records] = useState<any[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');

  const sd = useServerDate();

  // ── Last 7 days ──
  const loadLast7Days = useCallback(async () => {
    try {
      const r: any = await api.getLast7Days();
      setLast7Records(r?.records || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadLast7Days(); }, [loadLast7Days]);

  // ── loadData with request-id cancellation ──
  const loadDataReqRef = useRef(0);
  const loadData = useCallback(async () => {
    const reqId = ++loadDataReqRef.current;
    try {
      const s = await api.getSummary();
      if (reqId !== loadDataReqRef.current) return;
      setSummary(s);
      const tx = await api.getTransactions(1, 20);
      if (reqId !== loadDataReqRef.current) return;
      setTransactions(tx.transactions || []);
      setPages(tx.pages || 1);
      setPage(1);
      loadLast7Days();
    } catch {
      if (reqId !== loadDataReqRef.current) return;
      setToast(t('toastLoadFailed'));
    }
  }, [setToast, loadLast7Days]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Avatar ──
  const loadAvatar = async () => {
    const uid = getCurrentUserId();
    if (!uid) return;
    const CACHE_KEY = 'cached_avatar_b64';
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setAvatarUrl(cached);
    } catch {}
    try {
      const b64 = await api.getUserAvatar(uid);
      if (b64) {
        setAvatarUrl(b64);
        try { sessionStorage.setItem(CACHE_KEY, b64); } catch {}
      }
    } catch {}
  };
  useEffect(() => { loadAvatar(); }, []);

  // ── Tab-driven loads ──
  const loadChart = async () => {
    try { const d = await api.getChart(); setChart(d || []); } catch { setToast(t('toastLoadFailed')); }
  };
  const loadChartMonthly = async () => {
    try { const d = await api.getChartMonthly(); setChartMonthly(d); } catch { /* silent */ }
  };
  const loadBusinessSummary = async () => {
    try {
      const data: any = await api.getBusinessSummary();
      summaryRef.current = data;
      setBusinessSummary(data || {});
    } catch { /* silent */ }
  };
  const loadDailyRevenues = async () => {
    try {
      const todayStr = sd.today || new Date().toISOString().slice(0, 10);
      const monthStart = todayStr.slice(0, 7) + '-01';
      const r: any = await api.getDailyRevenue(1, 31, undefined, undefined, undefined, undefined, monthStart, todayStr);
      setDailyRevenues(r?.records || []);
    } catch { /* silent */ }
  };
  const loadProducts = async () => {
    try { const p = await api.getProducts(); setProducts(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  useEffect(() => {
    if (tab === 'chart') { loadChart(); loadChartMonthly(); loadDailyRevenues(); loadBusinessSummary(); }
    if (tab === 'supply') { loadProducts(); }
    if (tab === 'list') { loadLast7Days(); loadBusinessSummary(); loadDailyRevenues(); }
  }, [tab]);

  // ── Business summary + derived expense/revenue data ──
  useEffect(() => {
    loadBusinessSummary();
    loadDailyRevenues();
  }, []);

  // ── Derived chart values (needs sd.today) ──
  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0;

  // Card values — yesterday/this-month income/expense/profit from backend
  const todayExpenseSummary = toNum(businessSummary.today_expense);
  const monthExpenseSummary = toNum(businessSummary.month_expense_amount);
  const yesterdayIncome = toNum(businessSummary.yesterday_income);
  const yesterdayExpense = toNum(businessSummary.yesterday_expense);
  const yesterdayProfit = toNum(businessSummary.yesterday_profit);

  const monthIncome = () => dailyRevenues
    .reduce((s: number, r: any) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0);

  const toDec2Comma = (v: any) => {
    const n = parseFloat(String(v ?? 0)) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePage = async (p: number) => {
    try {
      const tx = await api.getTransactions(p, 20);
      setTransactions(tx.transactions || []);
      setPage(p);
    } catch {
      setToast(t('toastLoadFailed'));
    }
  };

  return {
    summary, transactions, page, pages,
    chart, chartMonthly, products,
    businessSummary, dailyRevenues,
    last7Records, setLast7Records, avatarUrl, setAvatarUrl,
    loadData, loadAvatar,
    todayExpenseSummary, monthExpenseSummary, yesterdayIncome, yesterdayExpense, yesterdayProfit, monthIncome,
    toDec2Comma,
    handlePage,
  };
}
