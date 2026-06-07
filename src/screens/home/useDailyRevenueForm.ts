import { useState, useEffect, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { api } from '../../api/client';
import { t } from '../../i18n';

const todayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const yesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayBeforeDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isFuture = (d: string) => d > todayDateStr();

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtDecInput = (s: string) => {
  s = s.replace(/[^0-9.]/g, '');
  return s.startsWith('.') ? '0' + s : s;
};

const toDec2 = (x: any) => String(parseFloat(x || 0).toFixed(2));

export interface UseDailyRevenueFormCallbacks {
  /** Show a toast message after save/delete */
  onToast: (msg: string) => void;
  /** Refresh last 7 days records after save */
  onRefreshLast7: (records: any[]) => void;
}

export function useDailyRevenueForm(callbacks: UseDailyRevenueFormCallbacks) {
  const { onToast, onRefreshLast7 } = callbacks;

  // ── Daily revenue ──
  const [dailyRevs, setDailyRevs] = useState<any[]>([]);
  const [revDate, setRevDate] = useState(todayDateStr());
  const [revDateErr, setRevDateErr] = useState(0);
  const [revDateKey, setRevDateKey] = useState(0);
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

  // Load existing record for a date (for quick-date pills + date picker)
  const loadRevForDate = (d: string) => {
    setRevDate(d);
    api
      .getDailyRevenue(1, 1, undefined, undefined, d)
      .then((r: any) => {
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
          setRevRevenue('');
          setRevTurnover('');
          setRevJD('');
          setRevNote('');
          setRevMarkedClosed(false);
        }
      })
      .catch(() => {});
  };

  // Sync uncontrolled date input when revDate changes externally (quick-date pills)
  useEffect(() => {
    if (revDateInputRef.current) revDateInputRef.current.value = revDate;
    setRevDateErr(0);
  }, [revDate]);

  // Daily revenue helpers
  const loadDailyRevs = useCallback(
    async (p = 1, yr?: number, mo?: number) => {
      setRevLoading(true);
      try {
        const r = await api.getDailyRevenue(p, 30, yr, mo);
        setDailyRevs(r?.records || []);
        setRevPages(r?.pages || 1);
        setRevPage(r?.page || 1);
      } catch {
        onToast(t('toastLoadFailed'));
      }
      setRevLoading(false);
    },
    [onToast],
  );

  useEffect(() => {
    loadDailyRevs(1, revYear, revMonth);
  }, [revYear, revMonth]);

  // Load yesterday's revenue for card footers
  useEffect(() => {
    let cancelled = false;
    const yd = fmtDate((() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })());
    api
      .getDailyRevenue(1, 1, undefined, undefined, yd)
      .then((r: any) => {
        if (!cancelled) setYesterdayRev(r.records?.[0] || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load last 30 days aggregated
  useEffect(() => {
    let cancelled = false;
    api
      .getDailyRevenue(1, 1, undefined, undefined, undefined, 30)
      .then((r: any) => {
        if (!cancelled) setWeekRev(r?.totals || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDailyRev = async () => {
    const isClosed = revMarkedClosed;
    if (!isClosed && (!revTurnover || parseFloat(revTurnover) <= 0)) {
      onToast(t('revTurnover') + ' 不能为空');
      return;
    }
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
        if (r.status === 'error') {
          onToast(r.message);
          setRevSaving(false);
          return;
        }
      }
      setRevRevenue('');
      setRevTurnover('');
      setRevJD('');
      setRevNote('');
      setEditingRevId(null);
      setRevDate(todayDateStr());
      setRevMarkedClosed(false);
      await loadDailyRevs(1, revYear, revMonth);
      const r = await api.getLast7Days();
      onRefreshLast7(r?.records || []);
    } catch {
      onToast(t('toastSubmitFailed'));
    }
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
    setRevRevenue('');
    setRevTurnover('');
    setRevJD('');
    setRevNote('');
    setRevMarkedClosed(false);
  };

  const deleteDailyRev = async (id: number) => {
    try {
      await api.deleteDailyRevenue(id);
      loadDailyRevs(1, revYear, revMonth);
    } catch {
      onToast(t('toastSubmitFailed'));
    }
  };

  return {
    // state
    revDate,
    revRevenue,
    revTurnover,
    revJD,
    revNote,
    editingRevId,
    revSaving,
    revMarkedClosed,
    revDateErr,
    revDateKey,
    revDateInputRef,
    revYear,
    revMonth,
    revLoading,
    revPages,
    revPage,
    dailyRevs,
    showRevMonthPicker,
    revPickerRef,
    revPickerAnim,
    revPickerPos,
    yesterdayRev,
    weekRev,
    // setters
    setRevDate,
    setRevRevenue,
    setRevTurnover,
    setRevJD,
    setRevNote,
    setEditingRevId,
    setRevMarkedClosed,
    setRevDateErr,
    setRevDateKey,
    setRevYear,
    setRevMonth,
    setShowRevMonthPicker,
    setRevPickerPos,
    // actions
    loadRevForDate,
    submitDailyRev,
    startEdit,
    cancelEdit,
    deleteDailyRev,
    loadDailyRevs,
    // helpers
    todayDateStr,
    yesterdayDateStr,
    dayBeforeDateStr,
    isFuture,
    fmtDecInput,
    toDec2,
  };
}
