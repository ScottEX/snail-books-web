import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../../api/client';
import { t } from '../../i18n';
import { getCurrentUserId } from '../../utils/storage';

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
  const [dailyRevenues, setDailyRevenues] = useState<any[]>([]);
  const [chartExpenses, setChartExpenses] = useState<any[]>([]);
  const [last7Records, setLast7Records] = useState<any[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');

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
    } catch {
      if (reqId !== loadDataReqRef.current) return;
      setToast(t('toastLoadFailed'));
    }
  }, [setToast]);

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

  // ── Last 7 days ──
  useEffect(() => {
    let cancelled = false;
    api.getLast7Days().then((r: any) => {
      if (!cancelled) setLast7Records(r?.records || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Tab-driven loads ──
  const loadChart = async () => {
    try { const d = await api.getChart(); setChart(d || []); } catch { setToast(t('toastLoadFailed')); }
  };
  const loadChartMonthly = async () => {
    try { const d = await api.getChartMonthly(); setChartMonthly(d); } catch { /* silent */ }
  };
  const loadChartExpenses = async () => {
    try {
      const all: any[] = [];
      let p = 1;
      while (true) {
        const tx: any = await api.getTransactions(p, 100);
        const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
        all.push(...exps);
        if (p >= (tx.pages || 1)) break;
        p++;
      }
      setChartExpenses(all);
    } catch { /* silent */ }
  };
  const loadBusinessSummary = async () => {
    try {
      const data: any = await api.getBusinessSummary();
      setBusinessSummary(data || {});
    } catch { /* silent */ }
  };
  const loadDailyRevenues = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const monthStart = todayStr.slice(0, 7) + '-01';
      const r: any = await api.getDailyRevenue(1, 31, undefined, undefined, undefined, undefined, monthStart, todayStr);
      setDailyRevenues(r?.records || []);
    } catch { /* silent */ }
  };
  const loadProducts = async () => {
    try { const p = await api.getProducts(); setProducts(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  useEffect(() => {
    if (tab === 'chart') { loadChart(); loadChartMonthly(); loadChartExpenses(); loadDailyRevenues(); loadBusinessSummary(); }
    if (tab === 'supply') { loadProducts(); }
  }, [tab]);

  // ── Business summary + derived expense/revenue data ──
  useEffect(() => {
    loadBusinessSummary();
    loadChartExpenses();
    loadDailyRevenues();
  }, []);

  // ── Derived chart values (needs sd.today) ──
  // Card numbers now come from businessSummary (backend SQL, no full-scan); retained
  // chartExpenses for dailyChartData (chart tab).
  const todayExpenseChart = (todayStr: string) => chartExpenses
    .filter((e: any) => e.date === todayStr)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const monthExpenseChart = (monthPrefix: string) => chartExpenses
    .filter((e: any) => String(e.date || '').startsWith(monthPrefix))
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0;

  // Card values — yesterday/this-month income/expense/profit from backend
  const todayExpenseSummary = toNum(businessSummary.today_expense_amount);
  const monthExpenseSummary = toNum(businessSummary.month_expense_amount);
  const yesterdayIncome = toNum(businessSummary.yesterday_income);
  const yesterdayExpense = toNum(businessSummary.yesterday_expense);
  const yesterdayProfit = toNum(businessSummary.yesterday_profit);

  const monthIncome = () => dailyRevenues
    .reduce((s: number, r: any) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0);

  // ── Daily chart data (last 12 days) ──
  const dailyChartData = useMemo(() => {
    const dates: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const income = dates.map(date =>
      dailyRevenues
        .filter((r: any) => r.date === date)
        .reduce((s: number, r: any) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0)
    );
    const expense = dates.map(date =>
      chartExpenses
        .filter((e: any) => e.date === date)
        .reduce((s: number, e: any) => s + (e.amount || 0), 0)
    );
    return { dates, income, expense };
  }, [dailyRevenues, chartExpenses]);

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
    businessSummary, dailyRevenues, chartExpenses,
    last7Records, setLast7Records, avatarUrl, setAvatarUrl,
    loadData, loadAvatar,
    todayExpenseChart, monthExpenseChart, todayExpenseSummary, monthExpenseSummary, yesterdayIncome, yesterdayExpense, yesterdayProfit, monthIncome,
    dailyChartData,
    toDec2Comma,
    handlePage,
  };
}
