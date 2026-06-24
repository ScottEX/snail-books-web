import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, langs, useLang } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { useToast } from '../hooks/useToast';
import PartnerScreen from './PartnerScreen';
import ProcurementScreen from './ProcurementScreen';
import ExpenseScreen from './ExpenseScreen';
import ReconHistoryScreen from './ReconHistoryScreen';
import ExpenseHistoryScreen from './ExpenseHistoryScreen';
import InvoiceScreen from './InvoiceScreen';
import ExpenseDetailScreen from './ExpenseDetailScreen';
import DailyRevenueHistory from './DailyRevenueHistory';
import ProcurementDetailScreen from './ProcurementDetailScreen';
import PdfPreviewPage from './PdfPreviewPage';
import { getCurrentUser, getCurrentUserId } from '../utils/storage';
import SlideScreen from '../components/SlideScreen';
import ProfileScreen from './ProfileScreen';
import UserManagementScreen from './UserManagementScreen';
import UserDetailScreen from './UserDetailScreen';
import ThemePickerModal from '../components/ThemePickerModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { useDailyRevenueForm } from './home/useDailyRevenueForm';
import { useNavigationStack, type SubPage } from './home/useNavigationStack';
import { useHomeData } from './home/useHomeData';
import { useServerDate } from '../hooks/useServerDate';
import DailyRevenuePanel from './home/DailyRevenuePanel';
import ExpenseSummaryCards from './expense/ExpenseSummaryCards';
import ChartsPanel from './ChartsPanel';
import { useEffect, useMemo, useRef, useState } from 'react';

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
    try {
      const saved = localStorage.getItem('active_tab');
      if (saved && ['expense', 'list', 'supply', 'chart', 'partner'].includes(saved)) return saved as Tab;
      return 'chart';
    } catch { return 'chart'; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem('active_tab', t); } catch {}
  };

  // summary/transactions/chart/products → useHomeData
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
  const [invoiceFilterBatchId, setInvoiceFilterBatchId] = useState<number | null>(null);
  const [expDetailRecord, setExpDetailRecord] = useState<any>(null);
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);
  const [userRefreshKey, setUserRefreshKey] = useState(0);
  const [partnerRefreshKey, setPartnerRefreshKey] = useState(0);
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
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string; email: string; avatar: string; is_disabled: boolean } | null>(null);
  // iOS-style push/pop nav: pageStack is the single source of truth
  // for which sub-screen (profile / recon / expense / daily / proc / pdf)
  // is on top of HomeScreen. pushPage() opens one (280ms slide-in);
  // popPage() reverses it (250ms slide-out via the `removing` flag).
  // The `s.includes(p) ? s : ...` guard prevents pushing the same
  // page twice while it's still on the stack.

  // SubPage type → useNavigationStack
  // Hydrate pageStack from history.state so a refresh lands the user
  // back on the same sub-page they were viewing. Fall back to [] for
  // a cold load (state is null) or a hostile/missing history.state.
  // pageStack → useNavigationStack
  // Hydrate pdfPreview from the URL hash on mount. The push effect
  // (below) reads the same prop on every refresh, but pdfPreview
  // itself is local state, so we seed it from the hash before the
  // effect can push 'pdf' onto the stack. Without this, a refresh
  // on the PDF URL would mount PdfPreviewPage with batchId=0.

  // Mirror of pageStack for synchronous reads inside the popstate
  // listener and popPage itself. The closure values from useState
  // would be stale when popstate fires back-to-back in <280ms.


  // pushPage / popPage → useNavigationStack hook


  // PDF push + popstate listener → useNavigationStack hook
  const [uploadingBg, setUploadingBg] = useState(false);
  const { showToast, ToastHost } = useToast();
  const navScaleAnims = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const [bgVersion, setBgVersion] = useState(0);
  const [bgReady, setBgReady] = useState(true); // default bg.jpg always ready
  const [bgImage, setBgImage] = useState(() => {
    // Read cached bg URL to show custom background instantly, avoid API wait.
    // localStorage is written by api.getBackground() (line ~326) and bg upload.
    try {
      const cached = localStorage.getItem('bg-image');
      if (cached) return cached;
    } catch {}
    return '/img/bg.jpg?v=2';
  });
  const [bgOpacity, setBgOpacity] = useState(() => {
    try {
      const uid = getCurrentUserId();
      const key = uid ? `bg-opacity-${uid}` : 'bg-opacity';
      const saved = localStorage.getItem(key);
      return saved !== null ? parseFloat(saved) : 0.5;
    } catch { return 0.5; }
  });

  // ── 收支总览数据（图表 Tab）──
  const {
    summary, transactions, page, pages,
    chart, chartMonthly, products,
    businessSummary, dailyRevenues,
    last7Records, setLast7Records, avatarUrl,
    loadData, loadAvatar,
    todayExpenseSummary, monthExpenseSummary, yesterdayIncome, yesterdayExpense, yesterdayProfit, monthIncome,
    toDec2Comma,
    handlePage,
  } = useHomeData(tab, showToast);

  // Background image crop moved to shared BgCropModal component.

  const sd = useServerDate();
  const {
    pageStack, removing, pdfPreview, setPdfPreview,
    pushPage, popPage, clearStack,
  } = useNavigationStack({
    previewRoute,
    onClosePreview,
    onPopProc: () => setProcDetailBatch(null),
    onPopUserDetail: () => { setSelectedUser(null); setPartnerRefreshKey(k => k + 1); },
  });
  const revForm = useDailyRevenueForm({
    onToast: (msg: string) => showToast(msg),
    onRefreshLast7: (records: any[]) => setLast7Records(records),
  });


  // last7Days → useHomeData


  // MONTHS_SHORT → useHomeData
  // loadData → useHomeData


  // loadAvatar → useHomeData

  // Cross-screen bg sync: ProfileScreen theme button uploads a new
  // background and dispatches 'bg-changed' so we refresh here. The
  // background is rendered by HomeScreen, not ProfileScreen, so this
  // is the only way the change becomes visible.
  useEffect(() => {
    const onBgChanged = (e: any) => {
      const url = e?.detail?.url;
      if (typeof url === 'string') {
        setBgImage(url);
        setBgReady(true);
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
        setBgReady(true);
        try { localStorage.setItem('bg-image', r.url); } catch {}
      } else {
        // No custom background — use default
        setBgImage('/img/bg.jpg?v=2');
        setBgReady(true);
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

  // Signal splash screen to close once the actual background image is loaded
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!bgReady) return;
    const img = document.createElement('img');
    const done = () => { (window as any).__appReady = true; };
    img.onload = done;
    img.onerror = done;
    img.src = `${bgImage}?v=${bgVersion}`;
  }, [bgReady, bgImage, bgVersion]);


  // loadChart/loadChartMonthly/loadProducts → useHomeData


  // businessSummary/chartExpenses/dailyRevenues → useHomeData


  // Chart derived values → useHomeData functions

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
      showToast(t('toastSubmitFailed'));
    }
  };


  // handlePage → useHomeData

  const handleDeleteTx = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      loadData();
    } catch {
      showToast(t('toastSubmitFailed'));
    }
  };


  const todayStr = sd.ready
    ? new Date(sd.today + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
    : '';

  // Background image crop flow is self-contained inside ThemePickerModal —
  // it calls onCoverImagePicked(file) after the user confirms in the
  // BgCropModal preview step. We just upload + refresh local state.
  const handleCoverImagePicked = async (file: File) => {
    setUploadingBg(true);
    try {
      const r: any = await api.uploadBackground(file);
      if (r?.url) {
        setBgImage(r.url);
        setBgReady(true);
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
      setBgImage('/img/bg.jpg?v=2');
      setBgReady(true);
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
            onManageUsers={() => pushPage('usermgmt')}
            refreshKey={userRefreshKey}
          />
        );
      case 'usermgmt':
        return <UserManagementScreen key={userRefreshKey} onBack={onBack} onUserSelect={async (u) => { if (!u.reviewed) { await api.admin.markReviewed(u.id); setUserRefreshKey(k => k + 1); } setSelectedUser(u); pushPage('userdetail'); }} />;
      case 'userdetail':
        return selectedUser ? (
          <UserDetailScreen user={selectedUser} onBack={onBack} onUpdated={() => setUserRefreshKey(k => k + 1)} />
        ) : null;
      case 'expense':
        return <ExpenseHistoryScreen onBack={onBack} refreshKey={expenseRefreshKey} onExpDetail={(e: any) => { setExpDetailRecord(e); pushPage('expdetail'); }} onInvoice={(batchId) => { setInvoiceFilterBatchId(batchId); pushPage('invoice'); }} />;
      case 'expdetail':
        return expDetailRecord ? (
          <ExpenseDetailScreen
            record={expDetailRecord}
            onBack={onBack}
            onDeleted={() => { setExpenseRefreshKey(k => k + 1); loadData(); }}
            onEdited={() => { setExpenseRefreshKey(k => k + 1); }}
          />
        ) : null;
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
      case 'invoice':
        return (
          <InvoiceScreen
            onBack={onBack}
            filterBatchId={invoiceFilterBatchId}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Background — default always visible, custom fades in on top */}
      <View style={[styles.bgLayer, { backgroundImage: `url(/img/bg.jpg?v=2)`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity } as any]} />
      <View style={[styles.bgLayer, styles.bgCustom, { backgroundImage: `url(${bgImage}?v=${bgVersion})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: bgReady && bgImage !== '/img/bg.jpg?v=2' ? 'blur(0)' : 'blur(16px)', opacity: bgReady && bgImage !== '/img/bg.jpg?v=2' ? bgOpacity : 0 } as any]} />

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
            top={p === 'profile' || p === 'invoice' ? 48 : 0}
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
                <TouchableOpacity key={l} onPress={() => { setLangState(l); loadData(); }}>
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
          <PartnerScreen onBack={() => setTab('list')} onProfile={() => pushPage('profile')} refreshKey={partnerRefreshKey} />
        ) : tab === 'supply' ? (
          <ProcurementScreen onDrawerOpen={() => setShowCartDrawer(true)} onDrawerClose={() => setShowCartDrawer(false)} onProcurementDetail={(batch) => { setProcDetailBatch(batch); pushPage('proc'); }} pendingEditBatch={pendingEditBatch} onPendingEditConsumed={() => setPendingEditBatch(null)} onInvoice={(batchId) => { setInvoiceFilterBatchId(batchId); pushPage('invoice'); }} />
        ) : (
          <>
            {/* Underlying tab content */}
            {tab === 'expense' ? (
              <ExpenseScreen onReconHistory={() => pushPage('recon')} onExpenseHistory={() => pushPage('expense')} />
            ) : (
              <>
                {/* 收支总览玻璃卡片：固定顶部不滚动 */}
                {tab === 'chart' && (
                  <View style={{ paddingTop: 4, marginBottom: 12 }}>
                    <View style={[styles.chartGlassCard, {
                      // @ts-ignore
                      backgroundImage: `linear-gradient(90deg, ${withAlpha(colors.expenseGradientStart, bgOpacity === 1 ? 0.30 : 0.48)} 0%, ${withAlpha(colors.expenseGradientEnd, bgOpacity === 1 ? 0.30 : 0.48)} 100%)`,
                    }]}>
                      {/* @ts-ignore — 收支总览大标题 */}
                      <Text style={{ fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: 'rgba(255,255,255,0.95)', }}>{t('summary')}</Text>
                      <View style={{ alignItems: 'flex-start', gap: 2 }}>
                        <Text style={styles.chartGlassLabel}>{t('cashOnHand')}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text style={styles.chartGlassSymbol}>¥</Text>
                          <Text style={styles.chartGlassValue}>
                            {toDec2Comma(businessSummary.cash_on_hand || 0)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={styles.chartGlassSubCard}>
                          <Text style={styles.chartGlassSubLabel}>{t('cumulativeRevenue')}</Text>
                          <Text style={styles.chartGlassSubValue}>
                            {'¥' + toDec2Comma(businessSummary.cumulative_revenue || 0)}
                          </Text>
                        </View>
                        <View style={styles.chartGlassSubCard}>
                          <Text style={styles.chartGlassSubLabel}>{t('cumulativeExpense')}</Text>
                          <Text style={styles.chartGlassSubValue}>
                            {'¥' + toDec2Comma(businessSummary.cumulative_expense || 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                {/* Tab Content */}
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {tab === 'list' && (
                <View style={{ paddingBottom: 100, paddingTop: 4 }}>
                  <DailyRevenuePanel
                    revDate={revForm.revDate}
                    revRevenue={revForm.revRevenue}
                    revTurnover={revForm.revTurnover}
                    revJD={revForm.revJD}
                    revNote={revForm.revNote}
                    revDateErr={revForm.revDateErr}
                    revDateKey={revForm.revDateKey}
                    revDateInputRef={revForm.revDateInputRef}
                    revSaving={revForm.revSaving}
                    revMarkedClosed={revForm.revMarkedClosed}
                    yesterdayRev={revForm.yesterdayRev}
                    weekRev={revForm.weekRev}
                    setRevRevenue={revForm.setRevRevenue}
                    setRevTurnover={revForm.setRevTurnover}
                    setRevJD={revForm.setRevJD}
                    setRevNote={revForm.setRevNote}
                    setRevMarkedClosed={revForm.setRevMarkedClosed}
                    setRevDateErr={revForm.setRevDateErr}
                    setRevDateKey={revForm.setRevDateKey}
                    loadRevForDate={revForm.loadRevForDate}
                    submitDailyRev={revForm.submitDailyRev}
                    todayDateStr={revForm.todayDateStr}
                    yesterdayDateStr={revForm.yesterdayDateStr}
                    dayBeforeDateStr={revForm.dayBeforeDateStr}
                    isFuture={revForm.isFuture}
                    fmtDecInput={revForm.fmtDecInput}
                    toDec2={revForm.toDec2}
                  />

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
                              {rec.date === revForm.todayDateStr() && (
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
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{revForm.toDec2(rec.revenue)}</Text>
                              ) : (
                                <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                                  <Path d="M4 6h16" />
                                </Svg>
                              )}
                              <Text style={styles.rev7CardAmtLabel}>{t('revRevenue')}</Text>
                            </View>
                            <View style={styles.rev7CardAmtCol}>
                              {rec.turnover > 0 ? (
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{revForm.toDec2(rec.turnover)}</Text>
                              ) : (
                                <Svg width={24} height={12} viewBox="0 0 24 12" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round">
                                  <Path d="M4 6h16" />
                                </Svg>
                              )}
                              <Text style={styles.rev7CardAmtLabel}>{t('revTurnover')}</Text>
                            </View>
                            <View style={styles.rev7CardAmtCol}>
                              {rec.jd_revenue > 0 ? (
                                <Text style={[styles.rev7CardAmtVal, { color: colors.textMain }]}>¥{revForm.toDec2(rec.jd_revenue)}</Text>
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
                <View style={{ paddingBottom: 100 }}>
                  {/* KPI 三行 */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={styles.chartKpiCard}>
                      <View style={styles.chartKpiRow}>
                        <View style={styles.chartKpiItem}>
                          <Text style={styles.chartKpiLabel}>{t('actualReceived')}</Text>
                          <Text style={styles.chartKpiVal}>{'¥' + toDec2Comma(businessSummary.actual_received)}</Text>
                        </View>
                        <View style={styles.chartKpiItem}>
                          <Text style={styles.chartKpiLabel}>{t('receivable')}</Text>
                          <Text style={styles.chartKpiVal}>{'¥' + toDec2Comma(businessSummary.receivable)}</Text>
                        </View>
                        <View style={styles.chartKpiItem}>
                          <Text style={styles.chartKpiLabel}>{t('discountAmount')}</Text>
                          <Text style={styles.chartKpiVal}>{'¥' + toDec2Comma(businessSummary.discount)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {/* 6 张收支卡片 */}
                  <ExpenseSummaryCards
                    yesterdayExpense={yesterdayExpense}
                    monthExpense={monthExpenseSummary}
                    yesterdayIncome={yesterdayIncome}
                    monthIncome={monthIncome()}
                  />
                  {/* 图表：月度趋势 + 分类占比 */}
                  {chartMonthly && (
                    <View style={{ marginTop: 16 }}>
                    <ChartsPanel
                      months={chartMonthly.months || []}
                      income={chartMonthly.income || []}
                      expense={chartMonthly.expense || []}
                      profit={chartMonthly.profit || []}
                      categories={chartMonthly.categories || {}}
                      dailyDates={chartMonthly.daily_dates || []}
                      dailyIncome={chartMonthly.daily_income || []}
                      dailyExpense={chartMonthly.daily_expense || []}
                      dailyProfitDates={chartMonthly.daily_dates || []}
                      dailyProfitValues={chartMonthly.daily_profit || []}
                    />
                    </View>
                  )}
                </View>
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
          { id: 'expense', icon: NavIconExpense },
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
              clearStack();
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

      {ToastHost}
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

function NavIconExpense({ active, colors }: { active: boolean; colors: ThemeColors }) {
  // Wallet icon — semantic match for "Expense" tab label (avoiding literal `+` ambiguity).
  // Other tabs use object/silhouette/chart icons; this one represents money-out.
  const c = active ? colors.textMain : colors.textSub;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 12V8H6a2 2 0 010-4h12v4" />
      <Path d="M4 6v12a2 2 0 002 2h14v-4" />
      <Path d="M18 12a2 2 0 100 4h4v-4h-4z" />
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
    position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
  },
  bgCustom: { },
  // Header — frosted glass, same as sub-screen headers
  header: {
    position: 'relative' as const, zIndex: 200,
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
  // ── Chart KPI cards ──
  chartKpiCard: {
    borderRadius: 14, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12, gap: 14,
    backgroundColor: colors.bg,
    borderWidth: 0.5, borderColor: colors.secondary,

  },
  chartKpiRow: { flexDirection: 'column' as any },
  chartKpiItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  chartKpiLabel: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight },
  chartKpiVal: { fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight, color: colors.textMain },
  // ── Chart glass card (在手资金) ──
  chartGlassCard: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, gap: 12,
    // @ts-ignore

  },
  chartGlassLabel: {
    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
    color: 'rgba(255,255,255,0.70)',

  },
  chartGlassSymbol: {
    fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
    color: colors.expenseAmountColor,

  },
  chartGlassValue: {
    fontSize: FONTS.h1.size + 4, fontWeight: FONTS.h1.weight,
    color: colors.expenseAmountColor,

  },
  chartGlassSubCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 14, gap: 6,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.20)',

  },
  chartGlassSubLabel: {
    fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight,
    color: 'rgba(255,255,255,0.70)',
  },
  chartGlassSubValue: {
    fontSize: FONTS.body.size, fontWeight: FONTS.h2.weight,
    color: 'rgba(255,255,255,0.95)',
  },
  // Bottom Nav — glass pill, icons only, 80% transparent
  bottomNav: {
    position: 'absolute' as any,
    bottom: 16,
    left: '50%',
    // @ts-ignore - web-only translateX
    transform: 'translateX(-50%)',
    width: '80%',
    maxWidth: 420,
    backgroundColor: withAlpha(colors.surface, 0.30),
    // @ts-ignore - web-only

    borderRadius: 28,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    // @ts-ignore - web-only boxShadow

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
  // 7-day card items — same card style as history page
  rev7CardItem: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: colors.secondary,
    // @ts-ignore

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
