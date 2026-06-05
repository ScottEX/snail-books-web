import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Animated, Image } from 'react-native';
import { createPortal } from 'react-dom';
import Svg, { Path, Circle } from 'react-native-svg';
import { t, setLang, getLang, langs } from '../i18n';
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

export default function HomeScreen({ onLogout }: { onLogout: () => void }) {
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
  const [lang, setLangState] = useState(getLang());

  // Add form
  const [txType, setTxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [showBgModal, setShowBgModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showReconHistory, setShowReconHistory] = useState(false);
  const [showExpenseHistory, setShowExpenseHistory] = useState(false);
  const [showDailyHistory, setShowDailyHistory] = useState(false);
  const [showProcDetail, setShowProcDetail] = useState(false);
  const [procDetailBatch, setProcDetailBatch] = useState<any>(null);
  const editProcurementRef = useRef<((batch: any) => void) | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Background crop state (mirrors cover crop in ProfileScreen) ──
  const [bgCropSrc, setBgCropSrc] = useState('');
  const [bgCropResult, setBgCropResult] = useState('');
  const [bgShowResult, setBgShowResult] = useState(false);
  const [bgCropMsg, setBgCropMsg] = useState('');
  const bgCropImgRef = useRef<HTMLImageElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgStageRef = useRef<HTMLDivElement | null>(null);
  const bgGuideRef = useRef<HTMLDivElement | null>(null);
  const bgCropState = useRef({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropW: 320, cropH: 0, cropRatio: 9 / 16, // viewport-adaptive (overridden by setupCanvas)
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

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

  const INCOME_CATS = ['🍜 堂食','🛵 美团外卖','🛵 饿了吗外卖','🎫 美团团购','📦 京东','🔧 其他收入'];
  const EXPENSE_CATS = ['📦 原材料进货','🏠 房租','⚡ 水电煤气','👨‍🍳 人工工资','🔧 设备/工具','🏗️ 装修','📋 培训/证件','🧹 卫生/清洁','🧻 餐具/纸巾','📦 包装/打包','📢 广告/推广','💊 杂项/烟酒','📝 其他'];
  const cats = { income: INCOME_CATS, expense: EXPENSE_CATS };

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

  const handleBgFileSelect = (e: any) => {
    const file = e.target?.files?.[0];
    // Always reset the file input value so the same file can be re-selected
    try { e.target.value = ''; } catch {}
    if (!file) return;
    // Close theme/background modal so the crop modal can take over
    setShowBgModal(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setBgCropSrc(src);
      setBgCropMsg('');
      setBgShowResult(false);
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => {
        bgCropImgRef.current = img;
        bgSetupCanvas();
        bgFitImage();
        bgDrawCrop();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Background crop handlers ──
  const bgSetupCanvas = () => {
    const stage = bgStageRef.current;
    const canvas = bgCanvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const s = bgCropState.current;
    // Source of truth: actual viewport ratio (matches the fullscreen background display).
    // The OUTPUT must use this ratio — never cap it down to fit the modal stage.
    s.cropRatio = window.innerHeight / window.innerWidth;
    // Fit the guide inside the stage while preserving the viewport ratio.
    // cropW is the tighter of: (a) stage width, (b) stage height / ratio.
    // This way the guide is always fully visible AND the output keeps the real ratio.
    s.cropW = Math.min(rect.width, rect.height / s.cropRatio);
    s.cropH = s.cropW * s.cropRatio;
    const guide = bgGuideRef.current;
    if (guide) {
      guide.style.width = s.cropW + 'px';
      guide.style.height = s.cropH + 'px';
    }
  };

  const bgFitImage = () => {
    const img = bgCropImgRef.current;
    if (!img) return;
    const s = bgCropState.current;
    const sw = s.cropW / img.naturalWidth;
    const sh = s.cropH / img.naturalHeight;
    s.scale = Math.max(sw, sh) * 1.05;
    s.minScale = Math.max(sw, sh);
    s.x = 0; s.y = 0; s.rotation = 0; s.flipX = false;
  };

  const bgClampCrop = () => {
    const img = bgCropImgRef.current;
    if (!img) return;
    const s = bgCropState.current;
    const hw = (img.naturalWidth * s.scale) / 2;
    const hh = (img.naturalHeight * s.scale) / 2;
    const hrh = s.cropH / 2, hrw = s.cropW / 2;
    const maxX = hw - hrw, maxY = hh - hrh;
    s.x = maxX > 0 ? Math.max(-maxX, Math.min(maxX, s.x)) : 0;
    s.y = maxY > 0 ? Math.max(-maxY, Math.min(maxY, s.y)) : 0;
  };

  const bgDrawCrop = () => {
    const canvas = bgCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = bgCropImgRef.current;
    if (!ctx || !img || !canvas) return;
    const s = bgCropState.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + s.x, canvas.height / 2 + s.y);
    ctx.rotate(s.rotation * Math.PI / 180);
    if (s.flipX) ctx.scale(-1, 1);
    ctx.scale(s.scale, s.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  const bgZoomCrop = (delta: number, cx: number, cy: number) => {
    const s = bgCropState.current;
    const newScale = Math.max(s.minScale, Math.min(s.maxScale, s.scale * (1 + delta)));
    const sd = newScale / s.scale;
    s.x = cx + (s.x - cx) * sd;
    s.y = cy + (s.y - cy) * sd;
    s.scale = newScale;
    bgClampCrop();
    bgDrawCrop();
  };

  const bgConfirmCrop = () => {
    try {
      const img = bgCropImgRef.current;
      if (!img) { setBgCropMsg(t('imgNotLoaded')); return; }
      const s = bgCropState.current;
      // Output: 1280 wide (high-res for retina), height follows the viewport-adaptive ratio
      const outW = 1280;
      const outH = Math.max(320, Math.round(outW * s.cropRatio));
      const output = document.createElement('canvas');
      output.width = outW; output.height = outH;
      const octx = output.getContext('2d')!;
      const outScale = outW / s.cropW;
      octx.translate(outW / 2 + s.x * outScale, outH / 2 + s.y * outScale);
      octx.rotate(s.rotation * Math.PI / 180);
      if (s.flipX) octx.scale(-1, 1);
      octx.scale(s.scale * outScale, s.scale * outScale);
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setBgCropResult(output.toDataURL('image/jpeg', 0.92));
      setBgShowResult(true);
    } catch { setBgCropMsg(t('cropFailed')); }
  };

  const bgDoUpload = async () => {
    if (!bgCropResult) return;
    setUploadingBg(true);
    try {
      const arr = bgCropResult.split(',');
      const mime = (arr[0].match(/:(.*?);/) || ['', 'image/jpeg'])[1];
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      const file = new File([blob], 'background.jpg', { type: mime });
      const r: any = await api.uploadBackground(file);
      if (r?.url) {
        setBgImage(r.url);
        try { localStorage.setItem('bg-image', r.url); } catch {}
        setBgVersion(v => v + 1);
        setBgCropSrc(''); setBgCropResult(''); setBgShowResult(false);
      } else { setBgCropMsg(t('uploadFailedShort')); }
    } catch { setBgCropMsg(t('uploadFailed')); }
    finally { setUploadingBg(false); }
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

  // ── Imperative background crop event binding ──
  useEffect(() => {
    if (!bgCropSrc || bgShowResult) return;
    const stage = bgStageRef.current;
    const canvas = bgCanvasRef.current;
    if (!stage || !canvas) return;

    // Defer initial draw until layout settles (helps on first-open animation)
    setTimeout(() => { bgSetupCanvas(); bgClampCrop(); bgDrawCrop(); }, 60);

    let frameId = 0;
    const scheduleDraw = () => {
      if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; bgDrawCrop(); });
    };

    const toLocal = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left - canvas.width / 2, y: clientY - r.top - canvas.height / 2 };
    };

    const guide = bgGuideRef.current;
    const setGuideActive = (active: boolean) => {
      if (!guide) return;
      guide.style.borderColor = active ? '#fff' : 'rgba(255,255,255,0.8)';
      guide.style.boxShadow = active
        ? '0 0 0 9999px rgba(0,0,0,0.62)'
        : '0 0 0 9999px rgba(0,0,0,0.55)';
    };

    const onResize = () => { bgSetupCanvas(); bgClampCrop(); bgDrawCrop(); };
    window.addEventListener('resize', onResize);

    const onMD = (e: MouseEvent) => {
      const s = bgCropState.current; s.drag.active = true;
      s.drag.sx = e.clientX; s.drag.sy = e.clientY;
      s.drag.ox = s.x; s.drag.oy = s.y;
      setGuideActive(true);
    };
    const onMM = (e: MouseEvent) => {
      const s = bgCropState.current; if (!s.drag.active) return;
      s.x = s.drag.ox + (e.clientX - s.drag.sx);
      s.y = s.drag.oy + (e.clientY - s.drag.sy);
      bgClampCrop(); scheduleDraw();
    };
    const onMU = () => { bgCropState.current.drag.active = false; setGuideActive(false); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      bgZoomCrop(e.deltaY > 0 ? -0.08 : 0.08, p.x, p.y);
    };

    const getDist = (ts: TouchList) =>
      Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const s = bgCropState.current;
      if (e.touches.length === 1) {
        s.drag.active = true;
        s.drag.sx = e.touches[0].clientX; s.drag.sy = e.touches[0].clientY;
        s.drag.ox = s.x; s.drag.oy = s.y;
        setGuideActive(true);
      } else if (e.touches.length === 2) {
        s.drag.active = false; setGuideActive(false);
        s.pinch.active = true;
        s.pinch.startDist = getDist(e.touches);
        s.pinch.startScale = s.scale;
        const r = stage.getBoundingClientRect();
        s.pinch.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left - canvas.width / 2;
        s.pinch.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top - canvas.height / 2;
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const s = bgCropState.current;
      if (s.drag.active && e.touches.length === 1) {
        s.x = s.drag.ox + (e.touches[0].clientX - s.drag.sx);
        s.y = s.drag.oy + (e.touches[0].clientY - s.drag.sy);
        bgClampCrop(); scheduleDraw();
      } else if (s.pinch.active && e.touches.length === 2) {
        const d = getDist(e.touches);
        const ns = Math.max(s.minScale, Math.min(s.maxScale, s.pinch.startScale * (d / s.pinch.startDist)));
        const sd = ns / s.scale;
        s.x = s.pinch.midX + (s.x - s.pinch.midX) * sd;
        s.y = s.pinch.midY + (s.y - s.pinch.midY) * sd;
        s.scale = ns; bgClampCrop(); scheduleDraw();
      }
    };
    const onTE = (e: TouchEvent) => {
      const s = bgCropState.current;
      if (e.touches.length < 2) s.pinch.active = false;
      if (e.touches.length === 0) { s.drag.active = false; setGuideActive(false); }
    };

    canvas.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE);
    canvas.addEventListener('touchcancel', onTE);

    return () => {
      canvas.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTS);
      canvas.removeEventListener('touchmove', onTM);
      canvas.removeEventListener('touchend', onTE);
      canvas.removeEventListener('touchcancel', onTE);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
    };
  }, [bgCropSrc, bgShowResult]);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const bgCropS = useMemo(() => getBgCropStyles(), []);
  const usr = useMemo(() => getCurrentUser() || '用户', []);

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={[styles.bgLayer, { backgroundImage: `url(${bgImage}?v=${bgVersion})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity } as any]} />

      {/* History screen overlay — renders on top of background, main content hidden */}
      <SlideScreen visible={showProfile} onClose={() => setShowProfile(false)} top={48}>
        {(onBack) => <ProfileScreen onBack={onBack} onLogout={onLogout} onLangChange={() => loadData()} onAvatarChange={() => { try { sessionStorage.removeItem('cached_avatar_b64'); } catch {} loadAvatar(); }} />}
      </SlideScreen>
      <SlideScreen visible={showExpenseHistory} onClose={() => setShowExpenseHistory(false)}>
        {(onBack) => <ExpenseHistoryScreen onBack={onBack} />}
      </SlideScreen>
      <SlideScreen visible={showDailyHistory} onClose={() => setShowDailyHistory(false)}>
        {(onBack) => <DailyRevenueHistory onBack={onBack} />}
      </SlideScreen>
      <SlideScreen visible={showReconHistory} onClose={() => setShowReconHistory(false)}>
        {(onBack) => <ReconHistoryScreen onBack={onBack} />}
      </SlideScreen>
      <SlideScreen visible={showProcDetail} onClose={() => { setShowProcDetail(false); setProcDetailBatch(null); }}>
        {(onBack) => <ProcurementDetailScreen batch={procDetailBatch} onBack={onBack} onEdit={() => {
          setShowProcDetail(false);
          setTimeout(() => editProcurementRef.current?.(procDetailBatch), 150);
        }} />}
      </SlideScreen>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => setShowProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                <TouchableOpacity key={l} onPress={() => { setLang(l, loadData); setLangState(l); }}>
                  <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Page content — hidden when history screen is active */}
      {!showProfile && !showExpenseHistory && !showDailyHistory && !showReconHistory && !showProcDetail && (
      <View style={styles.page}>
        {tab === 'partner' ? (
          <PartnerScreen onBack={() => setTab('list')} onProfile={() => setShowProfile(true)} />
        ) : tab === 'supply' ? (
          <ProcurementScreen onDrawerOpen={() => setShowCartDrawer(true)} onDrawerClose={() => setShowCartDrawer(false)} onProcurementDetail={(batch) => { setProcDetailBatch(batch); setShowProcDetail(true); }} onEditBatchRef={editProcurementRef} />
        ) : (
          <>
            {/* Underlying tab content */}
            {tab === 'expense' ? (
              <ExpenseScreen onReconHistory={() => setShowReconHistory(true)} onExpenseHistory={() => setShowExpenseHistory(true)} />
            ) : (
              <>
                {/* Tab Content */}
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {tab === 'list' && (
                <View style={{ paddingBottom: 120, paddingTop: 4 }}>
                  {/* ── 每日营收录入卡片 ── */}
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

                  {/* ── 近7天记录 ── */}
                  <View style={{ marginTop: 20 }}>
                    <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textMain} strokeWidth={2} strokeLinecap="round">
                          <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6" />
                        </Svg>
                        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub }}>{t('revHistory')}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => { setShowDailyHistory(true); }}
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
        onChooseCover={() => fileRef.current?.click()}
        onResetCover={handleBgReset}
        coverUploading={uploadingBg}
      />

      {/* Shared modal */}
      <LogoutConfirmModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onLogout={onLogout} />

      {/* Bottom Nav — hidden when history screens or cart drawer are active */}
      {!showProfile && !showExpenseHistory && !showDailyHistory && !showReconHistory && !showProcDetail && !showCartDrawer && (
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
              setShowReconHistory(false);
              setShowExpenseHistory(false);
              setShowDailyHistory(false);
            }}
          >
            <Animated.View style={{ transform: [{ scale: navScaleAnims[i] }] }}>
              <Icon active={id === 'partner' ? tab === 'partner' : tab === id} colors={colors} />
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>
      )}
      {/* Hidden file input for background upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgFileSelect}
      />

      {/* ====== BACKGROUND CROP MODAL (portal) ====== */}
      {bgCropSrc !== '' && !bgShowResult && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any}
          onClick={(e: any) => { if (e.target === e.currentTarget) { setBgCropSrc(''); setBgCropResult(''); } }}
        >
          <View style={bgCropS.header as any}>
            <Text style={bgCropS.title as any}>{t('editBg')}</Text>
            <TouchableOpacity onPress={() => { setBgCropSrc(''); setBgCropResult(''); }} style={bgCropS.closeBtn as any}>
              <Text style={bgCropS.closeBtnText as any}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={bgCropS.stage as any} ref={bgStageRef as any}>
            <canvas
              ref={bgCanvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' } as any}
            />
            <View style={bgCropS.guideWrap as any} pointerEvents="none">
              <View
                style={{ width: 320, height: Math.round(320 * Math.max(0.5, Math.min(2.4, (typeof window !== 'undefined' ? window.innerHeight / window.innerWidth : 9 / 16)))), borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', position: 'relative', transition: 'border-color 0.2s', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' } as any}
                ref={bgGuideRef as any}
              >
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '66.6%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '66.6%' } as any} />
              </View>
            </View>
            <View style={bgCropS.pill as any} pointerEvents="none" data-pill="true">
              <Text style={bgCropS.pillText as any}>{t('cropPill')}</Text>
            </View>
          </View>
          <View style={bgCropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={0}
                onChange={(e: any) => {
                  const s = bgCropState.current;
                  const tt = Number(e.target.value) / 100;
                  s.scale = s.minScale + (s.maxScale - s.minScale) * tt * 0.5;
                  s.scale = Math.max(s.minScale, s.scale);
                  bgClampCrop(); bgDrawCrop();
                }}
                style={{ flex: 1, height: 3, appearance: 'none', cursor: 'pointer', accentColor: '#5B5BD6', background: 'rgba(255,255,255,0.2)', borderRadius: 2 } as any}
              />
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>A</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 }} />
            <TouchableOpacity
              style={bgCropS.toolBtn as any}
              onPress={() => { bgCropState.current.rotation = (bgCropState.current.rotation + 90) % 360; bgDrawCrop(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropRotate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={bgCropS.toolBtn as any}
              onPress={() => { bgCropState.current.flipX = !bgCropState.current.flipX; bgDrawCrop(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropFlip')}</Text>
            </TouchableOpacity>
          </View>
          <View style={bgCropS.actions as any}>
            <TouchableOpacity
              style={bgCropS.cancelBtn as any}
              onPress={() => { setBgCropSrc(''); setBgCropResult(''); }}
            >
              <Text style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={bgCropS.confirmBtn as any}
              onPress={bgConfirmCrop}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('useThisBg')}</Text>
            </TouchableOpacity>
          </View>
          {bgCropMsg !== '' && (
            <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>{bgCropMsg}</Text>
          )}
        </div>,
        document.body
      )}

      {/* ====== BACKGROUND RESULT PREVIEW ====== */}
      {bgShowResult && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)' } as any}
          onClick={(e: any) => { if (e.target === e.currentTarget) { setBgShowResult(false); setBgCropSrc(''); } }}
        >
          <View style={bgCropS.resultCard as any}>
            <View style={bgCropS.resultBadge as any}>
              <Text style={{ fontSize: 20, color: '#1B7A4A' }}>✓</Text>
            </View>
            <Text style={bgCropS.resultLabel as any}>{t('bgUpdated')}</Text>
            {bgCropResult ? (
              <img
                src={bgCropResult}
                style={{
                  maxWidth: 280, maxHeight: 180,
                  width: Math.min(280, 280 * bgCropState.current.cropRatio > 180 ? 180 / bgCropState.current.cropRatio : 280),
                  height: Math.min(180, 280 * bgCropState.current.cropRatio),
                  borderRadius: 4, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)',
                }}
              />
            ) : null}
            <Text style={bgCropS.resultSub as any}>{t('bgResultHint')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
              <TouchableOpacity
                style={bgCropS.reEditBtn as any}
                onPress={() => { setBgShowResult(false); }}
              >
                <Text style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('recrop')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={bgCropS.saveBtn as any}
                onPress={bgDoUpload}
                disabled={uploadingBg}
              >
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{uploadingBg ? t('uploading') : t('confirmUse')}</Text>
              </TouchableOpacity>
            </View>
            {bgCropMsg !== '' && (
              <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontWeight: 500 }}>{bgCropMsg}</Text>
            )}
          </View>
        </div>,
        document.body
      )}

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
// ── Background image crop modal styles (rectangular, viewport-adaptive ratio) ──
function getBgCropStyles() {
  return {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any,
    header: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } as any,
    title: { fontSize: 14, fontWeight: '600' as const, color: '#fff', letterSpacing: -0.2 },
    closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' } as any,
    closeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 20 },
    stage: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000', cursor: 'move' } as any,
    guideWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as any,
    guideRect: {
      borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
      position: 'relative', transition: 'border-color 0.2s',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
    } as any,
    thirds: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)' } as any,
    pill: {
      position: 'absolute', bottom: 8, left: '50%', transform: [{ translateX: -75 }],
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    } as any,
    pillText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    toolbar: {
      paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexShrink: 0,
    } as any,
    toolBtn: { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 } as any,
    actions: {
      paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', gap: 10, flexShrink: 0,
    } as any,
    cancelBtn: {
      flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center',
    } as any,
    confirmBtn: {
      flex: 2, padding: 11, borderRadius: 12, backgroundColor: '#5B5BD6',
      justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    } as any,
    resultCard: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -160 }, { translateY: -130 }], backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: 320, alignItems: 'center', gap: 12 } as any,
    resultBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any,
    resultLabel: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
    resultSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    reEditBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' } as any,
    saveBtn: { flex: 2, padding: 12, borderRadius: 10, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center' } as any,
  };
}
