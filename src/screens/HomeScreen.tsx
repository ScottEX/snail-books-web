import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Animated, Image } from 'react-native';
import { createPortal } from 'react-dom';
import Svg, { Path, Circle } from 'react-native-svg';
import { t, langs, useLang } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import Toast from '../components/Toast';
import PartnerScreen from './PartnerScreen';
import ProcurementScreen from './ProcurementScreen';
import ExpenseScreen from './ExpenseScreen';
import ReconHistoryScreen from './ReconHistoryScreen';
import ExpenseHistoryScreen from './ExpenseHistoryScreen';
import DailyRevenueHistory from './DailyRevenueHistory';
import ProcurementDetailScreen from './ProcurementDetailScreen';
import PdfPreviewPage from './PdfPreviewPage';
import { getCurrentUser, getCurrentUserId } from '../utils/storage';
import SlideScreen from '../components/SlideScreen';
import ProfileScreen from './ProfileScreen';
import ThemePickerModal from '../components/ThemePickerModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

function DateErrorHint({ trigger, message, colors }: { trigger: number; message: string; colors: any }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (trigger > 0) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [trigger]);
  if (!show) return null;
  return <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'left', marginTop: 2 }}>{message}</Text>;
}
type Tab = 'list' | 'expense' | 'supply' | 'chart' | 'partner';

export default function HomeScreen({
  onLogout,
  previewRoute,
  onClosePreview,
}: {
  onLogout: () => void;
  /** URL-driven PDF preview (parses #/preview-pdf?… in App.tsx). */
  previewRoute?: { id: number; number: number } | null;
  /** Cleared when the user dismisses the preview — App.tsx drops the hash. */
  onClosePreview?: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem('active_tab') as Tab) || 'expense'; }
    catch { return 'expense'; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem('active_tab', t); } catch {}
  };
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [chart, setChart] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  // Pulled from LangContext — re-renders on LangContext value change
  // instead of capturing curLang at mount (so a new user's server-
  // side language actually reaches the lang selector).
  const { lang, setLang: setLangState } = useLang();

  // Add form
  const [txType, setTxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [showBgModal, setShowBgModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [procDetailBatch, setProcDetailBatch] = useState<any>(null);
  // External signal for ProcurementScreen.edit flow. When set, the
  // newly-mounted ProcurementScreen instance (which mounts when
  // popPage flips pageStack empty after the 280ms slide-out) will
  // pick it up via a useEffect and call openEditBatch on itself.
  // Replaces the old editProcurementRef pattern, which suffered from
  // stale-ref-to-unmounted-instance when proc detail closed.
  const [pendingEditBatch, setPendingEditBatch] = useState<any>(null);
  // Holds the active PDF preview target. Pushed onto pageStack as
  // 'pdf' via the useEffect below whenever App.tsx sees a matching
  // hash. Cleared on popPage so a fresh push always starts clean.
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  // iOS-style push/pop nav: pageStack is the single source of truth
  // for which sub-screen (profile / recon / expense / daily / proc / pdf)
  // is on top of HomeScreen. pushPage() opens one (280ms slide-in);
  // popPage() reverses it (250ms slide-out via the `removing` flag).
  // The `s.includes(p) ? s : ...` guard prevents pushing the same
  // page twice while it's still on the stack.
  type SubPage = 'profile' | 'recon' | 'expense' | 'daily' | 'proc' | 'pdf';
  // Hydrate pageStack from history.state so a refresh lands the user
  // back on the same sub-page they were viewing. Fall back to [] for
  // a cold load (state is null) or a hostile/missing history.state.
  const [pageStack, setPageStack] = useState<SubPage[]>(() => {
    try {
      const s = (history.state as any)?.stack;
      return Array.isArray(s) ? (s as SubPage[]) : [];
    } catch { return []; }
  });
  // Hydrate pdfPreview from the URL hash on mount. The push effect
  // (below) reads the same prop on every refresh, but pdfPreview
  // itself is local state, so we seed it from the hash before the
  // effect can push 'pdf' onto the stack. Without this, a refresh
  // on the PDF URL would mount PdfPreviewPage with batchId=0.
  const [pdfPreview, setPdfPreview] = useState<{ id: number; number: number } | null>(() => {
    if (previewRoute) return previewRoute;
    try {
      const m = window.location.hash.match(/^#\/preview-pdf\?id=(\d+)(?:&.*)?$/);
      if (!m) return null;
      const qs = window.location.hash.split('?')[1] || '';
      const num = parseInt(new URLSearchParams(qs).get('number') || '0', 10);
      return { id: parseInt(m[1], 10), number: num };
    } catch { return null; }
  });
  // Mirror of pageStack for synchronous reads inside the popstate
  // listener and popPage itself. The closure values from useState
  // would be stale when popstate fires back-to-back in <280ms.
  const pageStackRef = useRef<SubPage[]>([]);
  useEffect(() => { pageStackRef.current = pageStack; }, [pageStack]);
  // Persist every change to pageStack back into history.state so a
  // refresh restores the same sub-page. replaceState (not pushState)
  // — we don't want each push to add a new history entry; the
  // popstate listener + the one sentinel entry on mount is enough.
  useEffect(() => {
    try {
      history.replaceState(
        { app: 'snail-books', stack: pageStack },
        '',
        location.href,
      );
    } catch {}
  }, [pageStack]);
  const [removing, setRemoving] = useState<SubPage | null>(null);
  const pushPage = (p: SubPage) => setPageStack(s => s.includes(p) ? s : [...s, p]);
  const popPage = () => {
    const stack = pageStackRef.current;
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];
    setRemoving(top);
    setTimeout(() => {
      setPageStack(s => s.slice(0, -1));
      setRemoving(null);
      // Per-page payload cleanup so a fresh push of the same page
      // never sees stale data from a previous open.
      if (top === 'proc') setProcDetailBatch(null);
      if (top === 'pdf') {
        setPdfPreview(null);
        // Mirror the dismissal back up to App.tsx so the URL hash
        // is dropped (a back-out of PDF should clear the URL too).
        onClosePreview?.();
      }
    }, 280);
  };

  // Sync the URL-driven PDF preview route with our pageStack.
  // App.tsx owns the hash; this effect turns the prop into a push.
  // Guard: if 'pdf' is already on the stack, don't push again — the
  // user might be reloading on the same URL.
  //
  // The ignorePopstateUntil ref is set 500ms after a PDF push to
  // swallow any popstate that may fire as a side effect of the hash
  // change (Chrome sometimes fires popstate when the hash is rewritten
  // and the page's own onPopState listener would otherwise interpret
  // it as a "user pressed back" and pop the just-pushed PDF right
  // back off the stack). 500ms is a safety window — by then the
  // hashchange has settled and any real browser-back will be a new
  // popstate long after the ignore flag has cleared.
  const ignorePopstateUntil = useRef(0);
  useEffect(() => {
    if (previewRoute) {
      setPdfPreview(previewRoute);
      setPageStack(s => s.includes('pdf') ? s : [...s, 'pdf']);
      // The ignorePopstateUntil safety window is now a no-op for
      // in-app nav: ProcurementDetailScreen's eye button uses
      // onPreview → history.replaceState + pushPage, so neither
      // hashchange nor popstate fires. The 0ms floor is kept for
      // any future code path that might still set location.hash
      // directly, and as a defence-in-depth margin.
      ignorePopstateUntil.current = 0;
    }
    // When previewRoute goes null we DON'T pop here — popPage's
    // own cleanup (above) handles it via onClosePreview, which is
    // what flips previewRoute back to null in App.tsx. This avoids
    // a "pop → effect → pop" loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRoute]);
  // Browser back / iOS swipe-back: when a sub-page is on the stack,
  // pop it (iOS-style "back one level" semantics). When the stack
  // is empty, the back gesture closes the app as usual.
  useEffect(() => {
    // Push a sentinel state on mount so the FIRST back press triggers
    // popstate (otherwise the browser would just exit the SPA).
    try {
      if (history.state === null || (history.state as any)?.app !== 'snail-books') {
        history.pushState({ app: 'snail-books' }, '', location.href);
      }
    } catch {}
    const onPopState = () => {
      // Swallow popstates that arrive within the safety window
      // after a programmatic PDF hash change. See the
      // ignorePopstateUntil comment near the push effect.
      if (Date.now() < ignorePopstateUntil.current) return;
      if (pageStackRef.current.length > 0) {
        popPage();
        // Re-push a sentinel so the next back can also be intercepted.
        // Defer one tick so popPage's setState can flush first.
        setTimeout(() => {
          try {
            history.pushState({ app: 'snail-books' }, '', location.href);
          } catch {}
        }, 0);
      }
      // Stack empty → let the browser handle the back (exit / navigate).
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // popPage is stable (reads pageStackRef, which is the ref we just made).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [last7Records, setLast7Records] = useState<any[]>([]);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [toast, setToast] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const navScaleAnims = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const [bgVersion, setBgVersion] = useState(0);
  const [bgImage, setBgImage] = useState(() => {
    try {
      const saved = localStorage.getItem('bg-image');
      return saved || '/img/bg.jpg';
    } catch { return '/img/bg.jpg'; }
  });
  const [bgOpacity, setBgOpacity] = useState(() => {
    try {
      const uid = getCurrentUserId();
      const key = uid ? `bg-opacity-${uid}` : 'bg-opacity';
      const saved = localStorage.getItem(key);
      return saved !== null ? parseFloat(saved) : 0.5;
    } catch { return 0.5; }
  });
  // Background image crop moved to shared BgCropModal component.

  // Daily revenue states
  const todayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const yesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const dayBeforeDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [dailyRevs, setDailyRevs] = useState<any[]>([]);
  const [revDate, setRevDate] = useState(todayDateStr());
  const [revDateErr, setRevDateErr] = useState(0);
  const [revDateKey, setRevDateKey] = useState(0);
  const isFuture = (d: string) => d > todayDateStr();
  const [revRevenue, setRevRevenue] = useState('');
  const [revTurnover, setRevTurnover] = useState('');
  const [revJD, setRevJD] = useState('');
  const [revNote, setRevNote] = useState('');
  const [revPage, setRevPage] = useState(1);
  const [revPages, setRevPages] = useState(1);
  const [revYear, setRevYear] = useState(new Date().getFullYear());
  const [revMonth, setRevMonth] = useState(new Date().getMonth() + 1);
  const [revLoading, setRevLoading] = useState(false);
  const [revSaving, setRevSaving] = useState(false);
  const [showRevMonthPicker, setShowRevMonthPicker] = useState(false);
  const [editingRevId, setEditingRevId] = useState<number | null>(null);
  const revPickerRef = useRef<any>(null);
  const revPickerAnim = useRef(new Animated.Value(0)).current;
  const revDateInputRef = useRef<HTMLInputElement>(null);
  const [revPickerPos, setRevPickerPos] = useState({ top: 0, left: 0 });
  const [yesterdayRev, setYesterdayRev] = useState<any>(null);
  const [weekRev, setWeekRev] = useState<any>(null);
  const [revMarkedClosed, setRevMarkedClosed] = useState(false);

  // Quick date helpers
  const td = todayDateStr();
  const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate()-1); return fmtDate(d); };
  const db4Str = () => { const d = new Date(); d.setDate(d.getDate()-2); return fmtDate(d); };
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const pickDate = (d: string) => { if (d <= td) loadRevForDate(d); };

  // Load existing record for a date (for quick-date pills + date picker)
  const loadRevForDate = (d: string) => {
    setRevDate(d);
    api.getDailyRevenue(1, 1, undefined, undefined, d).then((r: any) => {
      const rec = r?.records?.[0];
      if (rec) {
        setEditingRevId(rec.id);
        setRevRevenue(String(rec.revenue || ''));
        setRevTurnover(String(rec.turnover || ''));
        setRevJD(String(rec.jd_revenue || ''));
        setRevNote(rec.note || '');
        setRevMarkedClosed(!!rec.archived);
      } else {
        setEditingRevId(null);
        setRevRevenue(''); setRevTurnover(''); setRevJD(''); setRevNote('');
        setRevMarkedClosed(false);
      }
    }).catch(() => {});
  };

  // Sync uncontrolled date input when revDate changes externally (quick-date pills)
  useEffect(() => {
    if (revDateInputRef.current) revDateInputRef.current.value = revDate;
    setRevDateErr(0);
  }, [revDate]);

  // Daily revenue helpers
  const loadDailyRevs = useCallback(async (p = 1, yr?: number, mo?: number) => {
    setRevLoading(true);
    try {
      const r = await api.getDailyRevenue(p, 30, yr, mo);
      setDailyRevs(r?.records || []);
      setRevPages(r?.pages || 1);
      setRevPage(r?.page || 1);
    } catch { setToast(t('toastLoadFailed')); }
    setRevLoading(false);
  }, []);

  useEffect(() => { loadDailyRevs(1, revYear, revMonth); }, [revYear, revMonth]);

  // Load yesterday's revenue for card footers
  useEffect(() => {
    let cancelled = false;
    const yd = yesterdayStr();
    api.getDailyRevenue(1, 1, undefined, undefined, yd).then((r: any) => {
      if (!cancelled) setYesterdayRev(r.records?.[0] || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load last 30 days aggregated
  useEffect(() => {
    let cancelled = false;
    api.getDailyRevenue(1, 1, undefined, undefined, undefined, 30).then((r: any) => {
      if (!cancelled) setWeekRev(r?.totals || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load last 7 days table
  useEffect(() => {
    let cancelled = false;
    api.getLast7Days().then((r: any) => {
      if (!cancelled) setLast7Records(r?.records || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submitDailyRev = async () => {
    const isClosed = revMarkedClosed;
    if (!isClosed && (!revTurnover || parseFloat(revTurnover) <= 0)) { setToast(t('revTurnover') + ' 不能为空'); return; }
    setRevSaving(true);
    try {
      if (editingRevId) {
        await api.updateDailyRevenue(editingRevId, {
          revenue: parseFloat(revRevenue) || 0,
          turnover: parseFloat(revTurnover) || 0,
          jd_revenue: parseFloat(revJD) || 0,
          note: revNote,
          archived: revMarkedClosed ? 1 : 0,
        });
      } else {
        const r = await api.createDailyRevenue({
          date: revDate,
          revenue: parseFloat(revRevenue) || 0,
          turnover: parseFloat(revTurnover) || 0,
          jd_revenue: parseFloat(revJD) || 0,
          note: revNote,
          archived: revMarkedClosed ? 1 : 0,
        });
        if (r.status === 'error') { setToast(r.message); setRevSaving(false); return; }
      }
      setRevRevenue(''); setRevTurnover(''); setRevJD(''); setRevNote('');
      setEditingRevId(null); setRevDate(todayDateStr());
      setRevMarkedClosed(false);
      await loadDailyRevs(1, revYear, revMonth);
      const r = await api.getLast7Days();
      setLast7Records(r?.records || []);
    } catch { setToast(t('toastSubmitFailed')); }
    setRevSaving(false);
  };

  const startEdit = (rev: any) => {
    setEditingRevId(rev.id);
    setRevDate(rev.date);
    setRevRevenue(String(rev.revenue || ''));
    setRevTurnover(String(rev.turnover || ''));
    setRevJD(String(rev.jd_revenue || ''));
    setRevNote(rev.note || '');
    setRevMarkedClosed(!!rev.archived);
  };

  const cancelEdit = () => {
    setEditingRevId(null);
    setRevDate(todayDateStr());
    setRevRevenue(''); setRevTurnover(''); setRevJD(''); setRevNote('');
    setRevMarkedClosed(false);
  };

  const deleteDailyRev = async (id: number) => {
    try { await api.deleteDailyRevenue(id); loadDailyRevs(1, revYear, revMonth); }
    catch { setToast(t('toastSubmitFailed')); }
  };

  const fmtDecInput = (s: string) => { s = s.replace(/[^0-9.]/g, ''); return s.startsWith('.') ? '0' + s : s; };
  const toDec2 = (x: any) => String(parseFloat(x || 0).toFixed(2));

  const MONTHS_SHORT = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  const loadData = useCallback(async () => {
    try {
      const s = await api.getSummary();
      setSummary(s);
      const tx = await api.getTransactions(1, 20);
      setTransactions(tx.transactions || []);
      setPages(tx.pages || 1);
      setPage(1);
    } catch { setToast(t('toastLoadFailed')); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadAvatar = async () => {
    const uid = getCurrentUserId();
    if (!uid) return;
    const CACHE_KEY = 'cached_avatar_b64';
    // Serve from cache immediately to avoid flash
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setAvatarUrl(cached);
    } catch {}
    try {
      const resp = await fetch(`/api/users/avatar?user_id=${uid}`);
      if (resp.ok) {
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          setAvatarUrl(b64);
          try { sessionStorage.setItem(CACHE_KEY, b64); } catch {}
        };
        reader.readAsDataURL(blob);
      }
    } catch {}
  };

  useEffect(() => { loadAvatar(); }, []);

  // Cross-screen bg sync: ProfileScreen theme button uploads a new
  // background and dispatches 'bg-changed' so we refresh here. The
  // background is rendered by HomeScreen, not ProfileScreen, so this
  // is the only way the change becomes visible.
  useEffect(() => {
    const onBgChanged = (e: any) => {
      const url = e?.detail?.url;
      if (typeof url === 'string') {
        setBgImage(url);
        setBgVersion(v => v + 1);
      }
    };
    window.addEventListener('bg-changed', onBgChanged);
    return () => window.removeEventListener('bg-changed', onBgChanged);
  }, []);

  // Load background image — user-specific
  useEffect(() => {
    api.getBackground().then((r: any) => {
      if (r?.url) {
        setBgImage(r.url);
        try { localStorage.setItem('bg-image', r.url); } catch {}
      } else {
        // No custom background — use default
        setBgImage('/img/bg.jpg');
        try { localStorage.removeItem('bg-image'); } catch {}
      }
      // Load opacity from server (overrides localStorage default)
      if (r?.opacity !== null && r?.opacity !== undefined) {
        setBgOpacity(r.opacity);
        try {
          const uid = getCurrentUserId();
          localStorage.setItem(uid ? `bg-opacity-${uid}` : 'bg-opacity', String(r.opacity));
        } catch {}
      } else {
        // Migration: push localStorage opacity to server if not saved yet
        try {
          const uid = getCurrentUserId();
          const local = localStorage.getItem(uid ? `bg-opacity-${uid}` : 'bg-opacity');
          if (local !== null) {
            const v = parseFloat(local);
            api.saveBackgroundSettings({ opacity: v }).catch(() => {});
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const loadChart = async () => {
    try { const d = await api.getChart(); setChart(d || []); } catch { setToast(t('toastLoadFailed')); }
  };

  const loadProducts = async () => {
    try { const p = await api.getProducts(); setProducts(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  const loadProcurements = async () => {
    try { const p = await api.getProcurements(); setProcurements(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  useEffect(() => {
    if (tab === 'chart') loadChart();
    if (tab === 'supply') { loadProducts(); loadProcurements(); }
  }, [tab]);

  // ── Inject glass-slider CSS ──
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'glass-slider-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .glass-slider {
        -webkit-appearance: none; appearance: none;
        width: 100%; height: 32px; background: transparent; cursor: pointer;
        position: relative; z-index: 2;
      }
      .glass-slider:focus { outline: none; }
      .glass-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(255,255,255,0.72);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.55);
        box-shadow: 0 2px 10px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .glass-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
        box-shadow: 0 3px 14px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04);
      }
      .glass-slider::-webkit-slider-thumb:active {
        transform: scale(1.05);
        background: rgba(255,255,255,0.85);
      }
      .glass-slider::-moz-range-thumb {
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(255,255,255,0.72);
        backdrop-filter: blur(12px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.55);
        box-shadow: 0 2px 10px rgba(0,0,0,0.10);
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const handleAddTx = async () => {
    if (!amount || !category || !account) return;
    try {
      await api.createTransaction({ type: txType, amount: parseFloat(amount), category, account, note });
      setAmount(''); setCategory(''); setAccount(''); setNote('');
      loadData();
    } catch {
      setToast(t('toastSubmitFailed'));
    }
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

  const handleDeleteTx = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      loadData();
    } catch {
      setToast(t('toastSubmitFailed'));
    }
  };


  const todayStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

  // Background image crop flow is self-contained inside ThemePickerModal —
  // it calls onCoverImagePicked(file) after the user confirms in the
  // BgCropModal preview step. We just upload + refresh local state.
  const handleCoverImagePicked = async (file: File) => {
    setUploadingBg(true);
    try {
      const r: any = await api.uploadBackground(file);
      if (r?.url) {
        setBgImage(r.url);
        try { localStorage.setItem('bg-image', r.url); } catch {}
        setBgVersion(v => v + 1);
      } else { throw new Error(t('uploadFailedShort')); }
    } finally {
      setUploadingBg(false);
    }
  };

  const handleBgReset = async () => {
    setUploadingBg(true);
    try {
      await api.resetBackground();
      setBgImage('/img/bg.jpg');
      try { localStorage.removeItem('bg-image'); } catch {}
      setBgVersion(v => v + 1);
    } catch (err) { /* ignore */ }
    setUploadingBg(false);
    setShowBgModal(false);
  };

  const handleBgOpacityChange = (v: number) => {
    setBgOpacity(v);
    try {
      const uid = getCurrentUserId();
      localStorage.setItem(uid ? `bg-opacity-${uid}` : 'bg-opacity', String(v));
    } catch {}
    clearTimeout((window as any).__bgOpacityTimer);
    (window as any).__bgOpacityTimer = setTimeout(() => {
      api.saveBackgroundSettings({ opacity: v }).catch(() => {});
    }, 500);
  };

  // Background image crop event binding moved to BgCropModal.

  const styles = useMemo(() => getStyles(colors), [colors]);
  const usr = useMemo(() => getCurrentUser() || '用户', []);

  // Renders the body of a sub-page inside a SlideScreen. Adding a new
  // sub-page means: add a case here + add a push site (call pushPage).
  // No new <SlideScreen> block, no z-index math, no render-prop wiring.
  const renderSubPage = (p: SubPage) => (onBack: () => void) => {
    switch (p) {
      case 'profile':
        return (
          <ProfileScreen
            onBack={onBack}
            onLogout={onLogout}
            onLangChange={() => loadData()}
            onAvatarChange={() => { try { sessionStorage.removeItem('cached_avatar_b64'); } catch {} loadAvatar(); }}
          />
        );
      case 'expense':
        return <ExpenseHistoryScreen onBack={onBack} />;
      case 'daily':
        return <DailyRevenueHistory onBack={onBack} />;
      case 'recon':
        return <ReconHistoryScreen onBack={onBack} />;
      case 'proc':
        return (
          <ProcurementDetailScreen
            batch={procDetailBatch}
            onBack={onBack}
            onEdit={() => {
              // popPage triggers the 280ms slide-out; the new
              // ProcurementScreen instance (which mounts when pageStack
              // flips empty) will pick up pendingEditBatch via its
              // useEffect and call its own openEditBatch — setState
              // lands on a live component, no stale ref.
              popPage();
              setPendingEditBatch(procDetailBatch);
            }}
            onPreview={(id, number) => {
              // In-app nav to PDF preview: silent URL update via
              // replaceState (no popstate, no hashchange) + push
              // 'pdf' to the pageStack directly. Bypasses App.tsx's
              // hashchange flow because the popstate that fires from
              // `location.hash =` on iOS Safari comes too late for
              // any time-based safety window to absorb — so the page
              // would pop right back off the stack. Deep linking
              // (URL hash on app load) still goes through App.tsx's
              // hashchange listener → previewRoute → the
              // [previewRoute] useEffect, unchanged.
              try {
                history.replaceState(
                  { app: 'snail-books' },
                  '',
                  `#/preview-pdf?id=${id}&number=${number}`,
                );
              } catch {}
              setPdfPreview({ id, number });
              pushPage('pdf');
            }}
          />
        );
      case 'pdf':
        // Renders inside the same SlideScreen wrapper as 'proc' /
        // 'profile' / etc. — that gives PDF preview the same 280ms
        // push animation AND lets the frosted header read the
        // HomeScreen bgLayer through the transparent header area
        // (matching ProcurementDetailScreen's header exactly).
        return (
          <PdfPreviewPage
            batchId={pdfPreview?.id ?? 0}
            batchNumber={pdfPreview?.number ?? 0}
            onBack={onBack}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={[styles.bgLayer, { backgroundImage: `url(${bgImage}?v=${bgVersion})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity } as any]} />

      {/* Sub-page stack — iOS push/pop with z-index keyed to stack
          position so the top of the stack always covers what's below.
          Rendered as a single .map() over pageStack rather than 5
          hand-written SlideScreens: adding a new sub-page is now one
          switch case + one push site, not a new <SlideScreen> block. */}
      {pageStack.map((p, idx) => {
        const isTop = idx === pageStack.length - 1;
        return (
          <SlideScreen
            key={p}
            visible={removing !== p}
            onClose={popPage}
            stackIndex={idx}
            isTop={isTop}
            top={p === 'profile' ? 48 : 0}
          >
            {renderSubPage(p)}
          </SlideScreen>
        );
      })}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => pushPage('profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <Image source={{ uri: '/img/logo.jpg' }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            )}
            <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight }}>{usr}</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowBgModal(true)} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight }}>{t('bgSettings')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLogoutModal(true)}>
              <Text style={styles.logoutBtn}>{t('logout')}</Text>
            </TouchableOpacity>
            <View style={styles.langRow}>
              {langs.map(([l, label]) => (
                <TouchableOpacity key={l} onPress={() => { setLangState(l, loadData); }}>
                  <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Page content — hidden whenever any sub-page is on the stack */}
      {pageStack.length === 0 && (
      <View style={styles.page}>
        {tab === 'partner' ? (
          <PartnerScreen onBack={() => setTab('list')} onProfile={() => pushPage('profile')} />
        ) : tab === 'supply' ? (
          <ProcurementScreen onDrawerOpen={() => setShowCartDrawer(true)} onDrawerClose={() => setShowCartDrawer(false)} onProcurementDetail={(batch) => { setProcDetailBatch(batch); pushPage('proc'); }} pendingEditBatch={pendingEditBatch} onPendingEditConsumed={() => setPendingEditBatch(null)} />
        ) : (
          <>
            {/* Underlying tab content */}
            {tab === 'expense' ? (
              <ExpenseScreen onReconHistory={() => pushPage('recon')} onExpenseHistory={() => pushPage('expense')} />
            ) : (
              <>
                {/* Tab Content */}
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {tab === 'list' && (
                <View style={{ paddingBottom: 120, paddingTop: 4 }}>
                  <View style={styles.revCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.textMain} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M3 3v18h18M7 16l4-8 4 4 4-6" />
                        </Svg>
                        <Text style={styles.revTitle}>{t('dailyRevenue')}</Text>
                      </View>
                      {/*
                        editingRevId no longer shows cancel — date selection auto-loads data,
                        user can modify and save directly without explicit cancel/edit modes.
                      */}
                    </View>

                    {/* Quick date pills + date picker */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[{ label: t('revQuickToday'), d: td },
                          { label: t('revQuickYesterday'), d: yesterdayStr() },
                          { label: t('revQuickDB4'), d: db4Str() },
                        ].map(pill => (
                          <TouchableOpacity key={pill.d} onPress={() => pickDate(pill.d)} activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22,
                              backgroundColor: revDate === pill.d ? colors.primary : colors.bg,
                            }}>
                            <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: revDate === pill.d ? colors.surface : colors.textSub }}>
                              {pill.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ position: 'relative' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub }}>
                            {revDate.replace(/-/g, '/')}
                          </Text>
                          <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub }}>📅</Text>
                          {React.createElement('input', {
                            ref: revDateInputRef,
                            type: 'date', defaultValue: revDate, max: todayDateStr(), key: revDateKey,
                            onChange: (e: any) => { if (isFuture(e.target.value)) { revDateInputRef.current!.value = revDate; setRevDateKey(k => k + 1); setRevDateErr(c => c + 1); } else { loadRevForDate(e.target.value); } },
                            style: { position: 'absolute', top: -4, right: 0, bottom: -4, left: 0, opacity: 0.01, cursor: 'pointer' },
                          })}
                        </View>
                        <DateErrorHint trigger={revDateErr} message={t('errDateFuture')} colors={colors} />
                      </View>
                    </View>

                    {/* Three input cards */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={styles.revInputCard}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                          <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                        </Svg>
                        <Text style={styles.revInputCardTitle}>{t('revRevenue')}</Text>
                        <Text style={styles.revInputCardSub}>{t('revRevenueSub')}</Text>
                        <View style={styles.revInputCardInputWrap}>
                          <Text style={styles.revInputCardSymbol}>¥</Text>
                          <TextInput style={styles.revInputCardInput}
                            value={revRevenue} onChangeText={(v) => setRevRevenue(fmtDecInput(v))}
                            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSub} />
                        </View>
                        <Text style={styles.revInputCardFooter}>
                          {t('revYesterdayLabel')} {yesterdayRev ? `¥${toDec2(yesterdayRev.revenue)}` : t('revYesterdayNA')}
                        </Text>
                      </View>
                      <View style={styles.revInputCard}>
                        <Text style={{ fontSize: FONTS.sub.size, marginBottom: 6 }}>🛒</Text>
                        <Text style={styles.revInputCardTitle}>{t('revTurnover')}</Text>
                        <Text style={styles.revInputCardSub}>{t('revTurnoverSub')}</Text>
                        <View style={styles.revInputCardInputWrap}>
                          <Text style={styles.revInputCardSymbol}>¥</Text>
                          <TextInput style={styles.revInputCardInput}
                            value={revTurnover} onChangeText={(v) => setRevTurnover(fmtDecInput(v))}
                            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSub} />
                        </View>
                        <Text style={styles.revInputCardFooter}>
                          {t('revYesterdayLabel')} {yesterdayRev ? `¥${toDec2(yesterdayRev.turnover)}` : t('revYesterdayNA')}
                        </Text>
                      </View>
                      <View style={styles.revInputCard}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                          <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
                        </Svg>
                        <Text style={styles.revInputCardTitle}>{t('revJD')}</Text>
                        <Text style={styles.revInputCardSub}>{t('revJDSub')}</Text>
                        <View style={styles.revInputCardInputWrap}>
                          <Text style={styles.revInputCardSymbol}>¥</Text>
                          <TextInput style={styles.revInputCardInput}
                            value={revJD} onChangeText={(v) => setRevJD(fmtDecInput(v))}
                            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSub} />
                        </View>
                        <Text style={styles.revInputCardFooter}>
                          {t('revYesterdayLabel')} {yesterdayRev && yesterdayRev.jd_revenue > 0 ? `¥${toDec2(yesterdayRev.jd_revenue)}` : t('revYesterdayNA')}
                        </Text>
                      </View>
                    </View>

                    {/* Note */}
                    <TextInput style={styles.revNoteInput}
                      value={revNote} onChangeText={setRevNote}
                      placeholder={t('revNoteHint')} placeholderTextColor={colors.textSub} />

                    {/* Two action buttons */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.revArchiveBtn, { flex: 2 }, revMarkedClosed && styles.revArchiveBtnDone]}
                        onPress={() => {
                          const next = !revMarkedClosed;
                          setRevMarkedClosed(next);
                          if (next && !revNote.trim()) { setRevNote(t('revClosedReason')); }
                        }}
                        activeOpacity={0.7}>
                        <Text style={[styles.revArchiveText, revMarkedClosed && styles.revArchiveTextDone]}>
                          {revMarkedClosed ? t('revCancelArchive') : t('revMarkArchive')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.revSubmitBtn, { flex: 4 }, (!revMarkedClosed && (!revTurnover || parseFloat(revTurnover) <= 0) || revSaving) && { opacity: 0.5 }]}
                        onPress={submitDailyRev} disabled={(!revMarkedClosed && (!revTurnover || parseFloat(revTurnover) <= 0)) || revSaving}
                        activeOpacity={0.8}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {revSaving ? (
                            <Text style={styles.revSubmitText}>...</Text>
                          ) : (
                            <>
                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8" />
                              </Svg>
                              <Text style={styles.revSubmitText}>{revDate === todayDateStr() ? t('revSaveToday') : revDate === yesterdayDateStr() ? t('revSaveYesterday') : revDate === dayBeforeDateStr() ? t('revSaveDayBefore') : `储存${revDate.slice(5).replace('-', '')}数据`}</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Last 7 days summary */}
                    <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                      <View style={{ alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>{t('revWeekRevenue')}</Text>
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain }}>¥{weekRev ? toDec2(weekRev.revenue) : '0.00'}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>{t('revWeekTurnover')}</Text>
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain }}>¥{weekRev ? toDec2(weekRev.turnover) : '0.00'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>{t('revWeekJD')}</Text>
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain }}>¥{weekRev ? toDec2(weekRev.jd_revenue) : '0.00'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 20 }}>
                    <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textMain} strokeWidth={2} strokeLinecap="round">
                          <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6" />
                        </Svg>
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub }}>{t('revHistory')}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => pushPage('daily')}
                        activeOpacity={0.7}
                        style={{ marginLeft: 'auto' }}
                      >
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary }}>{t('revHistoryBtn')} →</Text>
                      </TouchableOpacity>
                    </View>

                    {last7Records.length === 0 ? (
                      <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                        <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub }}>...</Text>
                      </View>
                    ) : (
                      last7Records.map((rec: any, i: number) => (
                        <View key={i} style={styles.rev7CardItem}>
                          {/* Top row: date + today tag + status badge */}
                          <View style={styles.rev7CardTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.rev7CardDate}>{rec.date}</Text>
                              {rec.date === todayDateStr() && (
                                <View style={styles.rev7TodayTag}>
                                  <Text style={styles.rev7TodayTagText}>{t('today')}</Text>
                                </View>
                              )}
                            </View>
                            <View style={[styles.rev7CardBadge, (rec.status === '未录入' || !rec.recorded_by) ? styles.rev7CardBadgeGap : styles.rev7CardBadgeOk]}>
                              <View style={[styles.rev7CardDot, (rec.status === '未录入' || !rec.recorded_by) ? { backgroundColor: colors.danger } : { backgroundColor: colors.success }]} />
                              <Text style={[styles.rev7CardStatus, (rec.status === '未录入' || !rec.recorded_by) ? { color: colors.danger } : { color: colors.success }]}>
                                {rec.status === '未录入' || !rec.recorded_by ? t('revNotEntered') : t('revEntered')}
                              </Text>
                            </View>
                          </View>

                          {/* Archived badge */}
                          {rec.archived ? (
                            <View style={styles.rev7ArchivedBadge}>
                              <Text style={styles.rev7ArchivedBadgeText}>{t('revMarkArchive')}</Text>
                            </View>
                          ) : null}

                          {/* Amount row: three columns */}
                          <View style={styles.rev7CardAmounts}>
                            <View style={styles.rev7CardAmtCol}>
                              {rec.revenue > 0 ? (
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.revenue)}</Text>
                              ) : (
                                <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                                  <Path d="M4 6h16" />
                                </Svg>
                              )}
                              <Text style={styles.rev7CardAmtLabel}>{t('revRevenue')}</Text>
                            </View>
                            <View style={styles.rev7CardAmtCol}>
                              {rec.turnover > 0 ? (
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.turnover)}</Text>
                              ) : (
                                <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                                  <Path d="M4 6h16" />
                                </Svg>
                              )}
                              <Text style={styles.rev7CardAmtLabel}>{t('revTurnover')}</Text>
                            </View>
                            <View style={styles.rev7CardAmtCol}>
                              {rec.jd_revenue > 0 ? (
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{toDec2(rec.jd_revenue)}</Text>
                              ) : (
                                <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                                  <Path d="M4 6h16" />
                                </Svg>
                              )}
                              <Text style={styles.rev7CardAmtLabel}>{t('revJD')}</Text>
                            </View>
                          </View>

                          {/* Footer: recorded by */}
                          <View style={styles.rev7CardFooter}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={styles.rev7CardFooterText}>{t('recordedBy')}:</Text>
                              {rec.recorded_by ? (
                                <Text style={styles.rev7CardFooterText}>{rec.recorded_by}</Text>
                              ) : (
                                <Svg width={16} height={8} viewBox="0 0 16 8" fill="none" stroke={colors.secondary} strokeWidth={1.5} strokeLinecap="round">
                                  <Path d="M2 4h12" />
                                </Svg>
                              )}
                            </View>
                          </View>
                          {/* Note */}
                          {rec.note ? (
                            <View style={styles.rev7CardNote}>
                              <Text style={styles.rev7CardNoteText}>{rec.note}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {tab === 'chart' && (
                <View />
              )}
            </ScrollView>
          </>
        )}

        </>
      )}
    </View>
      )}  {/* end page-content conditional */}

      <ThemePickerModal
        visible={showBgModal}
        onClose={() => setShowBgModal(false)}
        showCoverTools
        coverOpacity={bgOpacity}
        onCoverOpacityChange={handleBgOpacityChange}
        onCoverImagePicked={handleCoverImagePicked}
        onResetCover={handleBgReset}
        coverUploading={uploadingBg}
      />

      {/* Shared modal */}
      <LogoutConfirmModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onLogout={onLogout} />

      {/* Bottom Nav — hidden when any sub-page is on the stack or cart drawer is active */}
      {pageStack.length === 0 && !showCartDrawer && (
      <View style={styles.bottomNav}>
        {([
          { id: 'expense', icon: NavIconAdd },
          { id: 'list', icon: NavIconList },
          { id: 'supply', icon: NavIconSupply },
          { id: 'chart', icon: NavIconChart },
          { id: 'partner', icon: NavIconPartner },
        ] as const).map(({ id, icon: Icon }, i) => (
          <TouchableOpacity
            key={id}
            style={[styles.navItem, (id === 'partner' ? tab === 'partner' : tab === id) && styles.navItemActive]}
            onPress={() => {
              Animated.sequence([
                Animated.spring(navScaleAnims[i], { toValue: 0.85, useNativeDriver: false, speed: 30, bounciness: 6 }),
                Animated.spring(navScaleAnims[i], { toValue: 1, useNativeDriver: false, speed: 20, bounciness: 14 }),
              ]).start();
              setTab(id as Tab);
              // Switching tabs swaps the underlying page, so any open
              // sub-page is dropped instantly (no exit animation —
              // we're going to a different context anyway).
              setPageStack([]);
              setRemoving(null);
            }}
          >
            <Animated.View style={{ transform: [{ scale: navScaleAnims[i] }] }}>
              <Icon active={id === 'partner' ? tab === 'partner' : tab === id} colors={colors} />
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>
      )}
      {/* Background image crop handled by shared BgCropModal (rendered below) */}

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

/* ===== NAV SVG ICONS ===== */

function NavIconList({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <Path d="M9 12h6M9 16h6" />
    </Svg>
  );
}

function NavIconAdd({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function NavIconSupply({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </Svg>
  );
}

function NavIconChart({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v18h18" />
      <Path d="M7 16l4-8 4 4 4-6" />
    </Svg>
  );
}

function NavIconPartner({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <Path d="M12 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Svg>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bgLayer: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
  },
  // Header — frosted glass, same as sub-screen headers
  header: {
    position: 'relative' as const, zIndex: 101,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    // @ts-ignore - web-only
    backdropFilter: 'saturate(200%) blur(30px)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  // 8600: color:#8C8583 font-size:13px
  date: { color: colors.textSub, fontSize: FONTS.sub.size },
  logoutBtn: { fontSize: FONTS.micro.size, color: colors.danger, fontWeight: FONTS.micro.weight },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  langActive: { color: colors.primary, backgroundColor: withAlpha(colors.danger, 0.1), fontWeight: FONTS.microBold.weight },
  // Page — 8600: padding:0 16px 110px, max-width:520px, margin:0 auto
  page: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, maxWidth: 520, alignSelf: 'center', width: '100%' },
  // Stats — 8600: grid-cols-4
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statItem: { flex: 1 },
  // 8600: stat-label font-size:11px color:#8C8583 font-weight:500
  statLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 4 },
  // 8600: stat-num font-size:28px font-weight:700
  statNum: { fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, lineHeight: 28 },
  // 8600: text-xs color:#EAE5E0
  statSub: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2 },
  // Tab bar — 8600: display:flex border-bottom
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.secondary, marginBottom: 16 },
  // 8600: tab padding:10px font-size:12px color:#8C8583
  tabItem: { paddingVertical: 10, paddingHorizontal: 0, marginRight: 0, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.textMain },
  tabItemText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
  tabActiveText: { color: colors.textMain },
  // Content
  content: { flex: 1 },
  // Transaction row — 8600: tx-row
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bg },
  txDot: { width: 7, height: 7, borderRadius: 4 },
  txCat: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight },
  txNote: { fontSize: FONTS.micro.size, color: colors.textSub },
  txAmt: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight },
  txDate: { fontSize: FONTS.micro.size, color: colors.textSub, width: 70 },
  txDel: { fontSize: FONTS.sub.size, color: colors.textSub, padding: 4 },
  // Pagination
  pageRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  pageBtn: { fontSize: FONTS.micro.size, color: colors.textSub, paddingHorizontal: 10, paddingVertical: 4 },
  pageBtnActive: { color: colors.textMain, fontWeight: FONTS.microBold.weight },
  // Add form — 8600 style
  addForm: { paddingTop: 4 },
  typeToggle: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface, alignItems: 'center' },
  typeBtnInc: { borderColor: colors.success, backgroundColor: withAlpha(colors.success, 0.1) },
  typeBtnExp: { borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, 0.1) },
  typeBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textSub },
  typeBtnIncText: { color: colors.success },
  typeBtnExpText: { color: colors.danger },
  addInput: { width: '100%', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.secondary, borderRadius: 8, fontSize: FONTS.sub.size, backgroundColor: colors.surface, color: colors.textSub, marginBottom: 8, fontFamily: undefined },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catBtn: { fontSize: FONTS.micro.size, color: colors.textSub, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.secondary },
  catBtnActive: { color: colors.primary, borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.03) },
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.textMain, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 8 },
  saveBtnText: { color: colors.surface, fontSize: FONTS.amount.size },
  // Supply
  sectionTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, paddingVertical: 10 },
  supplyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.secondary },
  supplyName: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, flex: 1 },
  supplyPrice: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  // Chart
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, width: 36, textAlign: 'right' },
  barWrap: { flex: 1, height: 16, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  barIncome: { backgroundColor: colors.success, height: '100%' },
  barExpense: { backgroundColor: colors.danger, opacity: 0.7, height: '100%' },
  barVal: { fontSize: FONTS.micro.size, color: colors.textSub, width: 90 },
  // Bottom Nav — glass pill, icons only, 80% transparent
  bottomNav: {
    position: 'fixed' as any,
    bottom: 16,
    left: '50%',
    // @ts-ignore - web-only translateX
    transform: 'translateX(-50%)',
    width: '80%',
    maxWidth: 420,
    backgroundColor: withAlpha(colors.surface, 0.30),
    // @ts-ignore - web-only
    backdropFilter: 'saturate(180%) blur(24px)',
    borderRadius: 28,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.3) inset',
    borderWidth: 0.5,
    borderColor: withAlpha(colors.surface, 0.25),
    zIndex: 100,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 22, marginHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  navLabel: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, letterSpacing: 0.3 },
  navLabelActive: { color: colors.textMain },
  /* ── Daily Revenue (每日营收) ── */
  revCard: {
    backgroundColor: withAlpha(colors.surface, 0.65), borderRadius: 14,
    borderWidth: 0.5, borderColor: withAlpha(colors.textMain, 0.08),
    padding: 18,
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(24px)',
    // @ts-ignore
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  },
  revTitle: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  // Three input cards
  revInputCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 10,
    padding: 10, borderWidth: 0.5, borderColor: colors.secondary,
  },
  revInputCardTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, marginBottom: 2 },
  revInputCardSub: { fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 8 },
  revInputCardInputWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  revInputCardSymbol: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub, marginRight: 2, marginBottom: 1 },
  revInputCardInput: { flex: 1, fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain, padding: 0, outline: 'none' },
  revInputCardFooter: { fontSize: FONTS.micro.size, color: colors.textSub },
  revNoteInput: {
    fontSize: FONTS.sub.size, color: colors.textSub, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.secondary,
    marginBottom: 14, outline: 'none',
  },
  revSubmitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
   },
  revSubmitText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  revArchiveBtn: {
    backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  revArchiveBtnDone: { backgroundColor: withAlpha(colors.primary, 0.1) },
  revArchiveText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  revArchiveTextDone: { color: colors.primary },
  // 7-day card items — same card style as history page
  rev7CardItem: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    gap: 12,
  },
  rev7CardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rev7CardDate: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  rev7TodayTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: withAlpha(colors.success, 0.1),
  },
  rev7TodayTagText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.success },
  rev7CardBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5,
  },
  rev7CardBadgeGap: { backgroundColor: withAlpha(colors.danger, 0.1) },
  rev7CardBadgeOk: { backgroundColor: withAlpha(colors.success, 0.1) },
  rev7CardDot: { width: 6, height: 6, borderRadius: 3 },
  rev7CardStatus: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight },
  rev7CardAmounts: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: colors.surface, borderRadius: 8,
  },
  rev7CardAmtCol: { alignItems: 'center', flex: 1, gap: 4 },
  rev7CardAmtVal: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight },
  rev7CardAmtLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  rev7CardFooter: {
    borderTopWidth: 0.5, borderTopColor: colors.secondary,
    paddingTop: 8,
  },
  rev7CardFooterText: { fontSize: FONTS.micro.size, color: colors.textSub },

  /* Archived badge */
  rev7ArchivedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  rev7ArchivedBadgeText: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.danger },

  /* Note display */
  rev7CardNote: { borderTopWidth: 0.5, borderTopColor: colors.secondary, paddingTop: 8, marginTop: 4 },
  rev7CardNoteText: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 16 },
} as any);
// Background image crop styles moved to BgCropModal.
