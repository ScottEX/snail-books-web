import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Animated, Image } from 'react-native';
import SubmitButton from '../components/SubmitButton';
import Svg, { Path, Polyline, Line, Circle, Rect } from 'react-native-svg';
import { t } from '../i18n';
import { useTheme, withAlpha, ThemeColors, REQUIRED_COLOR } from '../theme';
import { api } from '../api/client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FONTS } from '../theme';
import { EMAIL_RE } from '../utils/validation';
import { bottomSheetOverlay, sheetHandle } from '../sharedStyles';
import SheetHeader from '../components/SheetHeader';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useImagePreview } from '../hooks/useImagePreview';
import { useToast } from '../hooks/useToast';
import ReceiptUpload from '../components/ReceiptUpload';
import ExpenseNoteInput from '../components/ExpenseNoteInput';
import DatePicker from '../components/DatePicker';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import TrashIcon from '../components/icons/TrashIcon';
import ImagePreview from '../components/ImagePreview';
import ModalOverlay from '../components/ModalOverlay';

/* ═══════════════ SVG ICONS ═══════════════ */

const IcnBack = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24">
    <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth="2.2" fill="none" />
  </Svg>
);
const IcnPlus = ({ color }: { color: string }) => (
  <Svg width="14" height="14" viewBox="0 0 24 24" stroke={color} strokeWidth="2" fill="none">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);
const IcnCompany = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);
const IcnTax = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="8" x2="12" y2="12" />
    <Line x1="12" y1="16" x2="12.01" y2="16" />
  </Svg>
);
const IcnAddr = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <Circle cx="12" cy="10" r="3" />
  </Svg>
);
const IcnBank = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="2" />
    <Line x1="2" y1="10" x2="22" y2="10" />
  </Svg>
);
const IcnMail = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Polyline points="22,6 12,13 2,6" />
  </Svg>
);
const IcnPhone = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </Svg>
);
const IcnAccount = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Line x1="12" y1="1" x2="12" y2="23" />
    <Path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </Svg>
);
const IcnClose = ({ color }: { color: string }) => (
  <Svg width="14" height="14" viewBox="0 0 1088 1024">
    <Path d="M843.712 191.936l-6.08-5.568-5.184-3.84-5.696-3.328a67.712 67.712 0 0 0-80.448 11.264L520.768 416.064l-224.64-224.64-2.688-2.56c-27.968-24.32-68.224-24.256-92.672 0.128l-4.8 5.12-4.608 6.144-3.392 5.632a67.84 67.84 0 0 0 11.328 80.512L424.96 512l-227.2 227.328c-24.32 28.16-24.32 68.48 0 92.864l5.12 4.8 6.208 4.608 5.632 3.392c26.816 14.336 59.136 9.984 80.448-11.328l225.6-225.728 227.072 227.2c28.608 24.832 68.928 24 94.336-1.472l4.544-5.056 4.096-5.568a67.84 67.84 0 0 0-8.64-85.312L616.64 512.064l224.512-224.64 4.16-4.352c23.04-26.752 22.4-67.008-1.6-91.136z" fill={color} />
  </Svg>
);

/** Pen icon — same SVG as UserDetailScreen.PencilSvg */
const PencilSvg = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="M15 5l4 4" />
  </svg>
);

/** Stamp seal — active (done: 已开票 / pending: 未开票) */
const IcnSealActive = ({ color, label }: { color: string; label: string }) => (
  <svg width="52" height="52" viewBox="0 0 52 52">
    <circle cx="26" cy="26" r="24" fill="none" stroke={color} strokeWidth="1.5" />
    <circle cx="26" cy="26" r="21" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3 2" />
    <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} transform="rotate(-12, 26, 26)">{label}</text>
  </svg>
);

/* ═══════════════ AMOUNT FORMATTERS ═══════════════ */

/** Display-only formatter: 1234.5 → "1,234.50" (thousand-separated). Empty stays empty. */
function formatAmountForDisplay(raw: string): string {
  if (!raw) return '';
  const num = Number(raw);
  if (!isFinite(num) || isNaN(num)) return raw;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Storage formatter: trim trailing zeros, normalize to plain decimal string. */
function formatAmountForStorage(raw: string): string {
  if (!raw) return '';
  const num = Number(raw);
  if (!isFinite(num) || isNaN(num)) return raw;
  return num.toFixed(2);
}

/** Empty state icon for invoice records — FileText style */
const InvoiceEmptyIcon = ({ color }: { color: string }) => (
  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Line x1="8" y1="13" x2="16" y2="13" />
    <Line x1="8" y1="17" x2="14" y2="17" />
  </Svg>
);

/* ═══════════════ INVOICE SCREEN ═══════════════ */

type InvType = 'vat' | 'general';
type InvStatus = 'done' | 'pending';

interface InvoiceData {
  company_name: string;
  tax_id: string;
  bank_name: string;
  bank_account: string;
  address: string;
  phone: string;
  email: string;

  inv_type: InvType;
}

interface InvoiceRecord {
  id: number;
  user_id?: number;
  procurement_batch_id?: number | null;
  batch_number?: number | null;
  type: InvType;
  company: string;
  tax_id: string;
  amount: number;
  date: string;
  invoice_number: string;
  email: string;
  status: InvStatus;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

const EMPTY_INV: InvoiceData = {
  company_name: '', tax_id: '', bank_name: '', bank_account: '', address: '', phone: '', email: '', inv_type: 'vat' as InvType,
};

interface Props {
  onBack: () => void;
  filterBatchId?: number | null;
}

export default function InvoiceScreen({ onBack, filterBatchId }: Props) {
  const { colors: c } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const [tab, setTab] = useState<number>(filterBatchId ? 1 : 0);
  const [entryCardH, setEntryCardH] = useState(0);
  const winHRef = useRef(0);
  const drawerMaxH = entryCardH > 0 ? winHRef.current - entryCardH : undefined;
  const [invType, setInvType] = useState<InvType>('vat');
  const [data, setData] = useState<InvoiceData>(EMPTY_INV);
  const [orig, setOrig] = useState<InvoiceData>(EMPTY_INV);
  const [loaded, setLoaded] = useState(false);

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const data = await api.admin.check();
        setIsAdmin(data.is_admin === true);
      } catch { }
    })();
  }, []);

  // User email for display
  const [userEmail, setUserEmail] = useState('');
  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem('email'); } catch { return null; } })();
    if (stored) { setUserEmail(stored); return; }
    (async () => {
      try {
        const j: any = await api.admin.getMe();
        const u = j.user || j.data || j;
        if (u.email) setUserEmail(u.email);
      } catch { }
    })();
  }, []);

  // CSS injection for drawer animation
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dType, setDType] = useState<InvType>('general');
  const [dAmount, setDAmount] = useState('');
  const [dAmountFocus, setDAmountFocus] = useState(false);
  const [dDate, setDDate] = useState(new Date().toISOString().slice(0, 10));
  const [dRef, setDRef] = useState('');
  const [dNote, setDNote] = useState('');
  const [dEmail, setDEmail] = useState('');
  const [dEmailErr, setDEmailErr] = useState('');
  const [dInvoiceNo, setDInvoiceNo] = useState('');
  const [dStatus, setDStatus] = useState<InvStatus>('pending');

  // Batch selector
  const [dBatchId, setDBatchId] = useState<number | null>(null);
  const [batchList, setBatchList] = useState<any[]>([]);
  // File upload
  const [dFiles, setDFiles] = useState<File[]>([]);
  // Existing file path (for edit mode — already uploaded)
  const [dExistingFilePath, setDExistingFilePath] = useState<string[]>([]);
  // Preview state
  const { preview, openPreview, closePreview } = useImagePreview();

  // Parse file_path from backend (JSON array or legacy single string)
  const parseFilePaths = (fp: string | null | undefined): string[] => {
    if (!fp) return [];
    if (fp.startsWith('[')) { try { return JSON.parse(fp); } catch { return [fp]; } }
    return [fp];
  };
  // Records (API-driven, no more stub)
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Edit / delete target
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const { showToast, ToastHost } = useToast();

  // Load records from API
  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const filter: any = {};
      if (filterBatchId) filter.procurement_batch_id = filterBatchId;
      const list = await api.getInvoiceRecords(filter);
      setRecords(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('loadRecords failed', e);
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, [filterBatchId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Load invoice data (backend allows all logged-in users since 4b00e12)
  useEffect(() => {
    (async () => {
      try {
        const inv = await api.getInvoice();
        if (inv.status === 'ok' && inv.data) {
          const d = { ...EMPTY_INV, ...inv.data };
          setData(d);
          setOrig(d);
          setDEmail(inv.data.email || '');
          setInvType(inv.data.inv_type || 'vat');
        }
      } catch { }
      setLoaded(true);
    })();
  }, []);

  const hasChanged = JSON.stringify(data) !== JSON.stringify(orig);
  const isSaving = useRef(false);

  const handleSaveInfo = async () => {
    if (!hasChanged || isSaving.current) return;
    isSaving.current = true;
    try {
      const json = await api.updateInvoice({ ...data, inv_type: invType } as any);
      if (json.status === 'ok') {
        setOrig({ ...data, inv_type: invType });
      }
    } catch { }
    isSaving.current = false;
  };

  // Stats
  const totalCount = records.length;
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);
  const pendingCount = records.filter(r => r.status === 'pending').length;

  // Filtered records
  const filtered = records.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'done') return r.status === 'done';
    if (filter === 'vat') return r.type === 'vat';
    if (filter === 'general') return r.type === 'general';
    return true;
  });

  const FILTERS = [
    { key: 'all', label: t('invFilterAll') },
    { key: 'pending', label: t('invFilterPending') },
    { key: 'done', label: t('invFilterDone') },
    { key: 'general', label: t('invGeneral') },
    { key: 'vat', label: t('invVatSpecial') },
  ];

  const typeBadgeLabel = (tp: InvType) => tp === 'vat' ? t('invVatSpecial') : t('invGeneral');
  const typeBadgeClass = (tp: InvType) => tp === 'vat' ? sBadge.vat : sBadge.general;

  // ── Confirm delete invoice record (physical delete) ──
  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null || deleting) return;
    setDeleting(true);
    try {
      await api.deleteInvoiceRecord(confirmDeleteId);
      setConfirmDeleteId(null);
      await loadRecords();
    } catch (e: any) {
      showToast('⚠️ ' + (e?.message || t('errSessionExpired')));
    } finally {
      setDeleting(false);
    }
  };

  // ── Submit drawer (create or update) ──
  const handleDrawerSubmit = async () => {
    if (submitting) return;
    if (!dAmount) { showToast('⚠️ ' + t('invDrawerAmount')); return; }
    if (!data.company_name || !data.tax_id) { showToast('⚠️ ' + t('invEmpty')); return; }
    if (dStatus === 'done' && !dInvoiceNo.trim()) {
      showToast('⚠️ ' + t('invRecInvoiceNo'));
      return;
    }
    if (dEmail && !EMAIL_RE.test(dEmail)) {
      setDEmailErr(t('errEmailInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: dType,
        amount: Number(dAmount) || 0,
        date: dDate,
        company: data.company_name,
        tax_id: data.tax_id,
        invoice_number: dInvoiceNo.trim(),
        email: dEmail.trim(),
        status: dStatus,
        procurement_batch_id: dBatchId,
        note: dNote.trim(),
      };
      let rid: number;
      if (editingId) {
        // Edit mode: upload new files first, then PUT with merged file_path
        const uploadedPaths: string[] = [];
        for (const f of dFiles) {
          const res = await api.uploadInvoiceFile(editingId, f);
          uploadedPaths.push(res.file_path);
        }
        // Compute final file_path: kept existing (after deletions) + newly uploaded
        const finalFilePath = JSON.stringify([...dExistingFilePath, ...uploadedPaths]);
        await api.updateInvoiceRecord(editingId, { ...payload, file_path: finalFilePath });
        rid = editingId;
      } else {
        // New mode: create record first to get rid, then upload all files
        const res = await api.createInvoiceRecord(payload);
        rid = res.id;
        for (const f of dFiles) {
          await api.uploadInvoiceFile(rid, f);
        }
      }
      closeDrawer();
      await loadRecords();
    } catch (e: any) {
      showToast('⚠️ ' + (e?.message || t('errSessionExpired')));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Preview handlers ──
  const handlePreviewExisting = (index: number) => {
    openPreview(dExistingFilePath.map(p => api.getInvoiceFileUrl(p)), index);
  };

  const handlePreviewNew = (index: number) => {
    openPreview(dFiles.map(f => URL.createObjectURL(f)), index);
  };

  // ── Drawer animation ──
  const openDrawer = (forEdit?: InvoiceRecord) => {
    setDrawerOpen(true);
    winHRef.current = window.innerHeight;
    setEditingId(forEdit ? forEdit.id : null);
    setDType(forEdit ? (forEdit.type as InvType) : 'general');
    setDAmount(forEdit ? String(forEdit.amount) : '');
    setDDate(forEdit ? forEdit.date : new Date().toISOString().slice(0, 10));
    setDRef('');
    setDNote(forEdit ? (forEdit.note || '') : '');
    setDInvoiceNo(forEdit ? (forEdit.invoice_number || '') : '');
    setDStatus(forEdit ? (forEdit.status as InvStatus) : 'pending');
    setDBatchId(forEdit ? (forEdit.procurement_batch_id ?? null) : null);
    setDFiles([]);
    setDExistingFilePath(forEdit ? parseFilePaths(forEdit.file_path) : []);
    // Save edit snapshot for unchanged detection
    if (forEdit) {
      setEditSnapshot({
        type: forEdit.type, amount: String(forEdit.amount),
        date: forEdit.date, note: forEdit.note || '',
        invoice_number: forEdit.invoice_number || '',
        status: forEdit.status, procurement_batch_id: forEdit.procurement_batch_id ?? null,
        existingFiles: parseFilePaths(forEdit.file_path),
      });
    } else {
      setEditSnapshot(null);
    }
    // Fetch batch list (lightweight, all un-invoiced batches)
    (async () => {
      try {
        const list = await api.getProcurementBatchesLite();
        let batches = Array.isArray(list) ? list : [];
        // When editing, the record's own linked batch may be excluded by
        // the "un-invoiced" filter — add it back so the dropdown shows it
        if (forEdit && forEdit.procurement_batch_id && !batches.find((b: any) => b.id === forEdit.procurement_batch_id)) {
          batches = [{ id: forEdit.procurement_batch_id, batch_number: forEdit.batch_number, date: forEdit.date }, ...batches];
        }
        setBatchList(batches);
      } catch { setBatchList([]); }
    })();
    // Auto-fill user email from localStorage, fallback to API
    const stored = (() => { try { return localStorage.getItem('email'); } catch { return null; } })();
    if (stored) {
      setDEmail(stored);
    } else {
      (async () => {
        try {
          const j: any = await api.admin.getMe();
          const user = j.user || j.data || j;
          if (user.email) setDEmail(user.email);
        } catch { }
      })();
    }
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
    setEditingId(null);
    setDStatus('pending');
    setDInvoiceNo('');
    setDExistingFilePath([]);
    setDFiles([]);
    }, 250);
  };

  // Auto-fill amount when batch selected
  useEffect(() => {
    if (!dBatchId) return;
    (async () => {
      try {
        const j: any = await api.getProcurementBatchDetail(dBatchId);
        const batch = j.batch || j.data || j;
        const amt = batch.total || batch.total_amount || batch.amount || 0;
        setDAmount(Number(amt).toFixed(2));
      } catch { }
    })();
  }, [dBatchId]);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]} {...swipeBack}>
      {/* ═══ ENTRY CARD ═══ */}
      <View style={[s.entryCard, { backgroundColor: '#D15F6C' }]} onLayout={(e: any) => { const h = e.nativeEvent?.layout?.height; if (h && entryCardH === 0) setEntryCardH(h); }}>
          <View style={s.ecTop}>
            <TouchableOpacity style={[s.ecBackBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]} onPress={onBack}>
              <IcnBack color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <Text style={[s.ecTitle, { color: '#fff', flex: 1 }]}>{t('invTitle')}</Text>
            <TouchableOpacity style={[s.ecBtn, { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, flexShrink: 0 }]} onPress={() => {
            setDDate(new Date().toISOString().slice(0, 10));
            setDRef('');
            setDNote('');
            openDrawer();
          }}>
            <IcnPlus color="rgba(255,255,255,0.85)" />
            <Text style={[s.ecBtnText, { color: '#fff' }]}>{t('invApply')}</Text>
          </TouchableOpacity>
          </View>
          <View style={[s.ecStats, { marginBottom: 0 }]}>
            <View style={[s.ecStat, { borderRightColor: 'rgba(255,255,255,0.12)' }]}>
              <Text style={[s.ecStatNum, { color: '#fff' }]}>{totalCount}</Text>
              <Text style={[s.ecStatLbl, { color: 'rgba(255,255,255,0.5)' }]}>{t('invTotalCount')}</Text>
            </View>
            <View style={[s.ecStat, { borderRightColor: 'rgba(255,255,255,0.12)', flex: 2 }]}>
              <Text style={[s.ecStatNum, { color: '#fff' }]}>¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              <Text style={[s.ecStatLbl, { color: 'rgba(255,255,255,0.5)' }]}>{t('invTotalAmount')}</Text>
            </View>
            <View style={[s.ecStat, { borderRightWidth: 0 }]}>
              <Text style={[s.ecStatNum, { color: '#fff' }]}>{pendingCount}</Text>
              <Text style={[s.ecStatLbl, { color: 'rgba(255,255,255,0.5)' }]}>{t('invPending')}</Text>
            </View>
          </View>
        </View>

        {/* ═══ TABS ═══ */}
        <View style={[s.tabs, { backgroundColor: withAlpha(c.textMain, 0.06) }]}>
          <TouchableOpacity style={[s.tab, tab === 0 && [s.tabOn, { backgroundColor: c.primary, shadowColor: c.primary }]]} onPress={() => setTab(0)}>
            <Text style={[s.tabText, { color: tab === 0 ? '#fff' : c.textSub }]}>{t('invInfoTab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 1 && [s.tabOn, { backgroundColor: c.primary, shadowColor: c.primary }]]} onPress={() => setTab(1)}>
            <Text style={[s.tabText, { color: tab === 1 ? '#fff' : c.textSub }]}>{t('invRecordsTab')}</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ PANEL 0: INFO ═══ */}
        {tab === 0 && (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View>
            {/* Tips */}
            <View style={[s.tips, { backgroundColor: withAlpha(c.warning, 0.08), borderWidth: 0 }]}>
              <Text style={s.tipsIcon}>💡</Text>
              <Text style={[s.tipsText, { color: c.warning }]}>{t('invTips')}</Text>
            </View>

            {/* 抬头信息 */}
            <View style={s.section}>
              <View style={s.sectionTitleRow}>
                <Text style={[s.sectionTitleText, { color: c.textSub }]}>{t('invHeaderInfo')}</Text>
                <View style={[s.sectionTitleLine, { backgroundColor: withAlpha(c.textMain, 0.08) }]} />
              </View>
              <View style={[s.infoCard, { backgroundColor: c.surface, borderRadius: 12, marginBottom: 0, borderWidth: 0, marginHorizontal: 16 }]}>
                <EditableInfoRow icon={<IcnCompany color={c.info} />} iconBg={withAlpha(c.info, 0.1)} label={t('companyName')} placeholder={t('invPleaseMaintain')} value={data.company_name} colors={c} onChange={(v) => setData({ ...data, company_name: v })} editable={isAdmin} />
                <View style={{ height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 }} />
                <EditableInfoRow icon={<IcnTax color={c.warning} />} iconBg={withAlpha(c.warning, 0.1)} label={t('taxId')} placeholder={t('invPleaseMaintain')} value={data.tax_id} colors={c} mono filter={(v: string) => v.replace(/[^a-zA-Z0-9]/g, '')} onChange={(v) => setData({ ...data, tax_id: v })} editable={isAdmin} />
                <View style={{ height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 }} />
                <EditableInfoRow icon={<IcnAddr color={c.success} />} iconBg={withAlpha(c.success, 0.1)} label={t('addressPhone')} placeholder={t('invPleaseMaintain')} value={data.address} colors={c} onChange={(v) => setData({ ...data, address: v })} editable={isAdmin} />
                <View style={{ height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 }} />
                <EditableInfoRow icon={<IcnPhone color="#2E8B4A" />} iconBg="#EAF8EE" label={t('companyPhone')} placeholder={t('invPleaseMaintain')} value={data.phone} colors={c} keyboardType="phone-pad" filter={(v: string) => v.replace(/[^\d]/g, '').slice(0, 11)} validate={(v: string) => v && !/^1[3-9]\d{9}$/.test(v) ? t('errPhoneInvalid') : null} onChange={(v) => setData({ ...data, phone: v })} editable={isAdmin} />
              </View>
            </View>

            {/* 银行信息 */}
            <View style={s.section}>
              <View style={s.sectionTitleRow}>
                <Text style={[s.sectionTitleText, { color: c.textSub }]}>{t('invBankInfo')}</Text>
                <View style={[s.sectionTitleLine, { backgroundColor: withAlpha(c.textMain, 0.08) }]} />
              </View>
              <View style={[s.infoCard, { backgroundColor: c.surface, borderRadius: 12, marginBottom: 0, marginHorizontal: 16, borderWidth: 0 }]}>
                <EditableInfoRow icon={<IcnBank color={c.primary} />} iconBg={withAlpha(c.primary, 0.08)} label={t('bankName')} placeholder={t('invPleaseMaintain')} value={data.bank_name} colors={c} onChange={(v) => setData({ ...data, bank_name: v })} editable={isAdmin} />
                <View style={{ height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 }} />
                <EditableInfoRow icon={<IcnAccount color={c.primary} />} iconBg={withAlpha(c.primary, 0.08)} label={t('bankAccount')} placeholder={t('invPleaseMaintain')} value={data.bank_account} colors={c} mono keyboardType="numeric" onChange={(v) => setData({ ...data, bank_account: v })} editable={isAdmin} />
              </View>
            </View>

            {/* 收票方式 */}
            <View style={s.section}>
              <View style={s.sectionTitleRow}>
                <Text style={[s.sectionTitleText, { color: c.textSub }]}>{t('invReceiveMethod')}</Text>
                <View style={[s.sectionTitleLine, { backgroundColor: withAlpha(c.textMain, 0.08) }]} />
              </View>
              <View style={[s.infoCard, { backgroundColor: c.surface, borderRadius: 12, marginBottom: 0, marginHorizontal: 16, borderWidth: 0 }]}>
                <EditableInfoRow icon={<IcnMail color="#7B52AB" />} iconBg="#F0EAF8" label={t('invEmail')} placeholder={t('invPleaseMaintain')} value={userEmail || data.email} colors={c} onChange={(v) => setData({ ...data, email: v })} />
              </View>
            </View>
          </View>
          </ScrollView>
        )}

        {/* ═══ PANEL 1: RECORDS ═══ */}
        {tab === 1 && (
          <View style={s.scroll}>
            {/* Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterRow, { maxHeight: 36 }]} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, alignItems: 'center' }}>
              {FILTERS.map(f => (
                <TouchableOpacity key={f.key} style={[s.fc, { backgroundColor: c.surface, borderColor: c.secondary }, filter === f.key && { backgroundColor: c.primary, borderColor: c.primary }]} onPress={() => setFilter(f.key)}>
                  <Text style={[s.fcText, { color: filter === f.key ? '#fff' : c.textSub }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Invoice cards */}
            {recordsLoading ? (
              <View style={s.empty}>
                <Text style={[s.emptyText, { color: c.textSub }]}>...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<InvoiceEmptyIcon color={c.textSub} />}
                title={t('noRecords')}
                hint={t('emptyInvoiceHint')}
              />
            ) : (
              filtered.map(r => (
                <View key={r.id} style={[s.invCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
                  {/* Torn edge */}
                  <View style={[s.invTorn, { backgroundColor: c.primary }]} />
                  <TouchableOpacity activeOpacity={0.7} onPress={() => openDrawer(r)} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: c.secondary, flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4 } as any}>
                    <View style={[s.invBadge, typeBadgeClass(r.type)]}>
                      <Text style={[s.invBadgeText, { color: r.type === 'vat' ? c.primary : r.type === 'general' ? c.info : c.success }]}>{typeBadgeLabel(r.type)}</Text>
                    </View>
                    <View style={s.invMain}>
                      <Text style={[s.invCompany, { color: c.textMain }]} numberOfLines={1}>{r.company}</Text>
                      <Text style={[s.invTax, { color: c.textSub }]}>{r.tax_id}</Text>
                      <View style={s.invMeta}>
                        <Text style={[s.invDate, { color: c.textSub }]}>{r.date}</Text>
                        {!!r.invoice_number && (
                          <>
                            <Text style={{ color: c.secondary }}>·</Text>
                            <Text style={[s.invNo, { color: c.textSub }]}>{r.invoice_number}</Text>
                          </>
                        )}
                        {!!r.batch_number && (
                          <>
                            <Text style={{ color: c.secondary }}>·</Text>
                            <Text style={[s.invNo, { color: c.textSub }]}>{t('procNowBatch').replace('{n}', String(r.batch_number))}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={s.invSealWrap}>
                      {r.status === 'done' ? (
                        <IcnSealActive color={c.success} label={t('invRecStatusDone')} />
                      ) : (
                        <IcnSealActive color={c.warning} label={t('invRecStatusPending')} />
                      )}
                    </View>
                  </TouchableOpacity>
                  <View style={s.invBottom}>
                    <View>
                      <Text style={[s.invAmount, { color: c.primary }]}>¥{r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      <Text style={[s.invAmountLabel, { color: c.textSub }]}>{r.status === 'pending' ? t('invApplyAmount') : t('invTaxAmount')}</Text>
                    </View>
                    <View style={s.invActions}>
                      <TouchableOpacity style={[s.invDelBtn, { backgroundColor: withAlpha(c.textMain, 0.05) }]} onPress={() => setConfirmDeleteId(r.id)}>
                        <TrashIcon color={c.danger} size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          </View>
        )}


      {/* ═══ TOAST ═══ */}
      {ToastHost}

      {/* ═══ CONFIRM DELETE MODAL ═══ */}
      <ConfirmModal
        visible={confirmDeleteId != null}
        title={t('confirmDeleteRecord')}
        message={
          <>
            {t('invDelConfirmPrefix')}
            <Text style={{ fontWeight: '600', color: c.textMain }}>
              {records.find(r => r.id === confirmDeleteId)?.invoice_number || '—'}
            </Text>
            {t('invDelConfirmSuffix')}
          </>
        }
        confirmLabel={t('confirmDeleteRecord')}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setConfirmDeleteId(null)}
      />

      {/* ═══ DRAWER (stagger reveal) ═══ */}
      <ModalOverlay
        visible={drawerOpen}
        onClose={closeDrawer}
        animation="stagger"
        staggerCount={3}
        overlayStyle={bottomSheetOverlay as any}
        contentStyle={{ alignItems: 'stretch', justifyContent: 'flex-end' } as any}
      >
        {(anims) => (
          <View style={[s.drawer, { backgroundColor: c.surface, width: '100%', maxWidth: 768, alignSelf: 'center', maxHeight: drawerMaxH }]}>
            {/* Stagger item 0: header (handle bar + title, theme bg) */}
            <Animated.View style={{
              opacity: anims[0],
              transform: [{ translateY: anims[0].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
            }}>
              <View style={{ backgroundColor: c.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'column', alignItems: 'flex-start' }}>
                <SheetHeader title={editingId ? t('invRecEditTitle') : t('invRecAddTitle')} onClose={closeDrawer} />
              </View>
            </Animated.View>
            {/* Stagger item 1: content */}
            <Animated.View style={{
              opacity: anims[1],
              transform: [{ translateY: anims[1].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              flex: 1, minHeight: 0,
            }}>
              <ScrollView style={s.drawerBody} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerType')}</Text>
              <View style={s.dTypeRow}>
                {(['general', 'vat'] as InvType[]).map(tp => (
                  <TouchableOpacity key={tp} style={[s.dTypeChip, { backgroundColor: dType === tp ? c.primary : withAlpha(c.textMain, 0.06) }]} onPress={() => setDType(tp)}>
                    <Text style={[s.dTypeChipText, { color: dType === tp ? c.surface : c.textSub }]}>{tp === 'vat' ? t('invVatSpecial') : t('invGeneral')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Batch selector — above amount */}
              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerBatch')}</Text>
                <select
                  value={dBatchId ?? ''}
                  onChange={(e: any) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setDBatchId(id);
                  }}
                  style={{
                    width: '100%', paddingTop: 11, paddingBottom: 11, paddingLeft: 14, paddingRight: 14,
                    borderWidth: 0, borderRadius: 10, fontSize: 14,
                    backgroundColor: withAlpha(c.textMain, 0.03), color: c.textMain,
                    outline: 'none', appearance: 'none',
                  }}
                >
                  {batchList.length > 0 ? (
                    <>
                      <option value="">{t('invDrawerBatchPlaceholder')}</option>
                      {batchList.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {t('procNowBatch').replace('{n}', String(b.batch_number))}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>{t('invDrawerBatchPlaceholder')}</option>
                  )}
                </select>
              </View>

              {/* Amount — auto-filled from batch, with thousand-separator */}
              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerAmount')}<Text style={{ color: REQUIRED_COLOR }}>*</Text></Text>
                <View style={{ position: 'relative' }}>
                  <Text style={[s.dAmountPrefix, { color: c.textSub }]}>¥</Text>
                  <TextInput
                    style={[s.dInput, s.dAmountInput, dAmountFocus && s.dAmountInputFocus, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) }]}
                    value={dAmountFocus ? dAmount : formatAmountForDisplay(dAmount)}
                    onFocus={() => setDAmountFocus(true)}
                    onBlur={() => { setDAmountFocus(false); setDAmount(formatAmountForStorage(dAmount)); }}
                    onChangeText={setDAmount}
                    placeholder="0.00"
                    placeholderTextColor={c.textSub}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerBuyer')}<Text style={{ color: REQUIRED_COLOR }}>*</Text><Text style={{ color: c.textSub, fontWeight: '400', fontSize: 11, marginLeft: 'auto' } as any}>{t('invAutoFilled')}</Text></Text>
                <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) }]} value={data.company_name} editable={false} />
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerTaxId')}<Text style={{ color: REQUIRED_COLOR }}>*</Text><Text style={{ color: c.textSub, fontWeight: '400', fontSize: 11, marginLeft: 'auto' } as any}>{t('invAutoFilled')}</Text></Text>
                <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), fontFamily: 'DM Mono' } as any]} value={data.tax_id} editable={false} />
              </View>

              {/* VAT-only fields — 从开票信息反显 */}
              {dType === 'vat' && (() => {
                const vatFilled = (v: string) => v && v !== '-';
                const hint = (v: string) => vatFilled(v)
                  ? <Text style={{ color: c.textSub, fontWeight: '400', fontSize: 11, marginLeft: 'auto' } as any}>{t('invAutoFilled')}</Text>
                  : <Text style={{ color: c.danger, fontWeight: '400', fontSize: 11, marginLeft: 'auto' } as any}>{t('invVatGoMaintain')}</Text>;
                return (
                <>
                  <View style={s.dField}>
                    <Text style={[s.dLabel, { color: c.textSub }]}>{t('addressPhone')}<Text style={{ color: REQUIRED_COLOR }}>*</Text>{hint(data.address)}</Text>
                    <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) }]} value={data.address} editable={false} />
                  </View>
                  <View style={s.dField}>
                    <Text style={[s.dLabel, { color: c.textSub }]}>{t('companyPhone')}<Text style={{ color: REQUIRED_COLOR }}>*</Text>{hint(data.phone)}</Text>
                    <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), fontFamily: 'DM Mono' } as any]} value={data.phone} editable={false} />
                  </View>
                  <View style={s.dField}>
                    <Text style={[s.dLabel, { color: c.textSub }]}>{t('bankName')}<Text style={{ color: REQUIRED_COLOR }}>*</Text>{hint(data.bank_name)}</Text>
                    <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) }]} value={data.bank_name} editable={false} />
                  </View>
                  <View style={s.dField}>
                    <Text style={[s.dLabel, { color: c.textSub }]}>{t('bankAccount')}<Text style={{ color: REQUIRED_COLOR }}>*</Text>{hint(data.bank_account)}</Text>
                    <TextInput style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), fontFamily: 'DM Mono' } as any]} value={data.bank_account} editable={false} />
                  </View>
                </>
                );
              })()}

              {/* Date + Email side by side */}
              <View style={s.dRow}>
                <View style={[s.dField, { flex: 1, minWidth: 0, overflow: 'hidden' } as any]}>
                  <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerDate')}</Text>
                  <View style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: withAlpha(c.textMain, 0.03), overflow: 'visible' as any }}>
                    <DatePicker
                      date={dDate}
                      onChange={setDDate}
                      fontSize={FONTS.sub.size}
                      showChevron
                      showCalendarIcon
                    />
                  </View>
                </View>
                <View style={[s.dField, { flex: 1, minWidth: 0, overflow: 'hidden' } as any]}>
                  <Text style={[s.dLabel, { color: c.textSub }]}>{t('invEmail')}</Text>
                  <TextInput
                    style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), borderColor: dEmailErr ? c.danger : 'transparent', borderWidth: dEmailErr ? 1 : 0 }]}
                    value={dEmail}
                    onChangeText={(v) => { setDEmail(v); if (dEmailErr) setDEmailErr(''); }}
                    onBlur={() => { if (dEmail && !EMAIL_RE.test(dEmail)) { setDEmail(''); setDEmailErr(t('errEmailInvalid')); } }}
                    placeholder="email@example.com"
                    placeholderTextColor={c.textSub}
                    keyboardType="email-address"
                  />
                  {dEmailErr !== '' && <Text style={{ color: c.danger, fontSize: 11, marginTop: 4 }}>{dEmailErr}</Text>}
                </View>
              </View>

              {/* Status toggle (待开票 / 已开票) — capsule style, matches dTypeRow */}
              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invStatus')}</Text>
                <View style={s.dTypeRow}>
                  {(['pending', 'done'] as InvStatus[]).map(s_ => (
                    <TouchableOpacity
                      key={s_}
                      style={[s.dTypeChip, { backgroundColor: dStatus === s_ ? c.primary : withAlpha(c.textMain, 0.06) }]}
                      onPress={() => setDStatus(s_)}
                    >
                      <Text style={[s.dTypeChipText, { color: dStatus === s_ ? c.surface : c.textSub }]}>
                        {s_ === 'pending' ? t('invRecStatusPending') : t('invRecStatusDone')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Invoice number — only for done status */}
              {dStatus === 'done' && (
              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>
                  {t('invRecInvoiceNo')}<Text style={{ color: REQUIRED_COLOR }}>*</Text>
                </Text>
                <TextInput
                  style={[s.dInput, { color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), fontFamily: 'DM Mono' } as any]}
                  value={dInvoiceNo}
                  onChangeText={(v) => setDInvoiceNo(v.replace(/[^a-zA-Z0-9]/g, ''))}
                  placeholder="NO.2026060001"
                  placeholderTextColor={c.textSub}
                />
              </View>
              )}

              {/* File upload — only when status is done */}
              {dStatus === 'done' && (
                <View style={{ marginBottom: 8 }}>
                  <ReceiptUpload
                    existingImages={editingId && dExistingFilePath.length > 0 ? dExistingFilePath.map(p => api.getInvoiceFileUrl(p)) : []}
                    newFiles={dFiles}
                    onAdd={(files: File[]) => setDFiles(prev => [...prev, ...files])}
                    onRemoveExisting={(i: number) => { setDExistingFilePath(prev => prev.filter((_, j) => j !== i)); }}
                    onRemoveNew={(i: number) => setDFiles(dFiles.filter((_, j) => j !== i))}
                    getPreviewUrl={(f: File) => URL.createObjectURL(f)}
                    label={t('invUploadInvoice') as string}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                    onPreviewExisting={handlePreviewExisting}
                    onPreviewNew={handlePreviewNew}
                  />
                </View>
              )}

              <View style={s.dField}>
                <ExpenseNoteInput
                  label={t('invDrawerNote') as string}
                  value={dNote}
                  onChangeText={setDNote}
                  placeholder={t('invDrawerNotePlaceholder')}
                />
              </View>

            </ScrollView>
            </Animated.View>
            {/* Stagger item 3: submit */}
            <Animated.View style={{
              opacity: anims[2],
              transform: [{ translateY: anims[2].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
            }}>
            {(() => {
              const unchangedInEdit = editingId && editSnapshot
                && dType === editSnapshot.type
                && dAmount === editSnapshot.amount
                && dDate === editSnapshot.date
                && dNote === editSnapshot.note
                && dInvoiceNo === editSnapshot.invoice_number
                && dStatus === editSnapshot.status
                && dBatchId === editSnapshot.procurement_batch_id
                && dFiles.length === 0
                && JSON.stringify(dExistingFilePath) === JSON.stringify(editSnapshot.existingFiles);
              const vatMissing = dType === 'vat' && (
                !data.address || data.address === '-' ||
                !data.phone || data.phone === '-' ||
                !data.bank_name || data.bank_name === '-' ||
                !data.bank_account || data.bank_account === '-'
              );
              const nonLoadDisabled = !dAmount || !data.company_name || !data.tax_id
                || (dStatus === 'done' && !dInvoiceNo.trim())
                || (dStatus === 'done' && dFiles.length === 0 && dExistingFilePath.length === 0)
                || vatMissing
                || unchangedInEdit;
              return (
            <SubmitButton
              onPress={handleDrawerSubmit}
              loading={submitting}
              disabled={nonLoadDisabled}
              label={editingId ? t('invSave') : t('invSubmit')}
              style={[s.dSubmit, { backgroundColor: c.primary }, nonLoadDisabled && { opacity: 0.4 }]}
              textStyle={s.dSubmitText}
            />
              );
            })()}
            </Animated.View>
          </View>
        )}
      </ModalOverlay>

      {/* Image preview overlay — portal above drawer */}
      {preview && createPortal(
        <ImagePreview
          images={preview.images}
          initialIdx={preview.idx}
          visible={true}
          onClose={closePreview}
        />,
        document.body,
      )}
    </View>
  );
}

/* ═══════════════ EDITABLE INFO ROW ═══════════════ */

function EditableInfoRow({ icon, iconBg, label, value, colors, mono, onChange, editable = true, keyboardType, filter, validate, placeholder }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; colors: ThemeColors; mono?: boolean; onChange: (v: string) => void; editable?: boolean; keyboardType?: string; filter?: (v: string) => string; validate?: (v: string) => string | null; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState('');

  const commit = () => {
    if (validate) {
      const msg = validate(draft);
      if (msg) { setErr(msg); return; }
    }
    setErr('');
    if (draft !== value) onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={[sIR.row, { borderBottomColor: colors.secondary }]}>
        <View style={[sIR.icon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={sIR.body}>
          <Text style={[sIR.label, { color: colors.textSub }]}>{label}</Text>
          <TextInput
            style={[sIR.valueInput, { color: colors.textMain, fontFamily: mono ? 'DM Mono' : undefined } as any]}
            value={draft}
            onChangeText={(v) => setDraft(filter ? filter(v) : v)}
            onBlur={commit}
            autoFocus
            keyboardType={keyboardType as any}
            placeholder={value || '—'}
            placeholderTextColor={colors.textSub}
          />
          {err !== '' && <Text style={{ color: colors.danger, fontSize: 11, marginTop: 2 }}>{err}</Text>}
        </View>
        <TouchableOpacity style={sIR.editBtn} onPress={commit}>
          <PencilSvg color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[sIR.row, { borderBottomColor: colors.secondary }]}>
      <View style={[sIR.icon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={sIR.body}>
        <Text style={[sIR.label, { color: colors.textSub }]}>{label}</Text>
        <Text style={[sIR.value, { color: value ? colors.textMain : colors.textSub, fontWeight: value ? '500' : '400', fontFamily: mono ? 'DM Mono' : undefined } as any]} numberOfLines={1}>{value || placeholder || t('invEmpty')}</Text>
      </View>
      {editable && (
        <TouchableOpacity onPress={() => { setDraft(value); setEditing(true); }} activeOpacity={0.7}>
          <PencilSvg color={colors.textSub} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ═══════════════ STYLES ═══════════════ */

const s = StyleSheet.create({
  root: { flex: 1, position: 'relative' as any, overflow: 'hidden' as any } as any,

  /* FLOATING BACK BTN — over content, historyHeader style */
  backFloat: { position: 'absolute', top: 16, left: 16, zIndex: 90, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' } as any,
  scroll: { flex: 1 } as any,

  /* ENTRY CARD — full width, no horizontal margin */
  entryCard: {
    borderRadius: 0, paddingTop: 20, paddingRight: 20, paddingBottom: 14, paddingLeft: 20,
    position: 'relative', overflow: 'hidden' as any,
    marginBottom: 14,
  } as any,
  ecTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 } as any,
  ecBackBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
  ecLabel: { fontSize: 11, letterSpacing: 1.3, color: 'rgba(255,255,255,0.55)', marginBottom: 4, textTransform: 'uppercase' } as any,
  ecTitle: { fontSize: 18, fontWeight: '600', color: '#fff', letterSpacing: 0.3 } as any,
  ecIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' } as any,
  ecStats: { flexDirection: 'row', marginBottom: 16, gap: 0 } as any,
  ecStat: { flex: 1, paddingHorizontal: 12, borderRightWidth: 1 } as any,
  ecStatNum: { fontSize: 20, fontWeight: '600', color: '#fff', fontFamily: 'DM Mono', letterSpacing: -0.2 } as any,
  ecStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 } as any,
  ecBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
  } as any,
  ecBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' } as any,

  /* TABS */
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, borderRadius: 10, padding: 3 } as any,
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 } as any,
  tabOn: { shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } as any,
  tabText: { fontSize: 13, fontWeight: '500' } as any,

  /* TIPS */
  tips: { marginHorizontal: 16, marginBottom: 14, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1 } as any,
  tipsIcon: { fontSize: 15, flexShrink: 0, marginTop: 1 } as any,
  tipsText: { fontSize: 12, lineHeight: 19, flex: 1 } as any,

  /* SECTION HEADER */
  section: { paddingHorizontal: 0, marginTop: 12 } as any,
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8, paddingHorizontal: 16 } as any,
  sectionTitleText: { fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' } as any,
  sectionTitleLine: { flex: 1, height: 1 } as any,

  /* INFO CARD — full width, no horizontal margin */
  infoCard: { borderRadius: 0, borderWidth: 1, borderLeftWidth: 0, borderRightWidth: 0, overflow: 'hidden', marginBottom: 14 } as any,
  typeToggle: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 } as any,
  typeChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5 } as any,
  typeChipText: { fontSize: 12, fontWeight: '500' } as any,

  /* FILTER */
  filterRow: { marginBottom: 12 } as any,
  fc: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 } as any,
  fcText: { fontSize: 12 } as any,

  /* INVOICE CARD */
  invCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' } as any,
  invTorn: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, opacity: 0.4 } as any,
  invTop: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderStyle: 'dashed',
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4,
  } as any,
  invBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, flexShrink: 0, marginTop: 2 } as any,
  invBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, whiteSpace: 'nowrap' } as any,
  invMain: { flex: 1, minWidth: 0 } as any,
  invCompany: { fontSize: 14, fontWeight: '600', marginBottom: 3 } as any,
  invTax: { fontSize: 11, fontFamily: 'DM Mono', marginBottom: 4 } as any,
  invMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' } as any,
  invDate: { fontSize: 11 } as any,
  invNo: { fontSize: 10, fontFamily: 'DM Mono' } as any,
  invSealWrap: {
    flexShrink: 0, width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  } as any,
  invBottom: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any,
  invAmount: { fontSize: 20, fontWeight: '700', fontFamily: 'DM Mono', letterSpacing: -0.2 } as any,
  invAmountLabel: { fontSize: 10, marginTop: 1 } as any,
  invActions: { flexDirection: 'row', gap: 6 } as any,
  invDelBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },

  /* EMPTY */
  empty: { alignItems: 'center', paddingVertical: 48 } as any,
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.4 } as any,
  emptyText: { fontSize: 14, lineHeight: 22 } as any,

  /* DRAWER */
  drawerOverlay: { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 },
  drawer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' as const, display: 'flex' as any, flexDirection: 'column' as any, maxHeight: '90%' } as any,
  drawerBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 } as any,

  dLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any,
  dField: { marginBottom: 14 } as any,
  dInput: { width: '100%', paddingVertical: 11, paddingHorizontal: 14, borderWidth: 0, borderRadius: 10, fontSize: 14, outline: 'none' } as any,
  dAmountInput: { paddingLeft: 26, fontSize: 18, fontWeight: '700', fontFamily: 'DM Mono', letterSpacing: 0.2 } as any,
  dAmountInputFocus: { fontSize: 18, fontWeight: '700' } as any,
  dAmountPrefix: { position: 'absolute', left: 14, top: '50%', fontSize: 14, fontWeight: '600', fontFamily: 'DM Mono' } as any,
  dRow: { flexDirection: 'row', gap: 10 } as any,
  dTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 } as any,
  dTypeChip: { flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center' } as any,
  dTypeChipText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight } as any,
  dSubmit: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 20, marginBottom: 16, marginTop: 8 } as any,
  dSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' } as any,
});

/* ═══════════════ INFO ROW STYLES ═══════════════ */

const sIR = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12 } as any,
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
  body: { flex: 1, minWidth: 0 } as any,
  label: { fontSize: 11, marginBottom: 2 } as any,
  value: { fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' } as any,
  valueInput: { fontSize: 13, fontWeight: '500', borderWidth: 0, outline: 'none', background: 'transparent', padding: 0, flex: 1 } as any,
  editBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
});

/* ═══════════════ BADGE STYLES ═══════════════ */

const sBadge = StyleSheet.create({
  vat: {} as any,
  general: {} as any,
});
