import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  FlatList, Image, ActivityIndicator, StyleSheet
} from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { t } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';

type SubTab = 'new' | 'history' | 'products';

interface Product {
  id: number; name: string; spec: string; price: number; supplier: string;
}
interface CartItem {
  product: Product; quantity: number; subtotal: number;
}
interface BatchRecord {
  id: number; batch_number: number; date: string;
  payment_method: string; category: string; total: number;
  images: string[]; note: string; items: any[];
}
interface ProcStats {
  total_spent: number; total_income: number; batch_count: number; margin_pct: number;
}

// ═══════════════════════════════════════════════
// SVG Icons (18px, 1.5 stroke — matching ExpenseScreen)
// ═══════════════════════════════════════════════

function CartIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="21" r="1" /><Circle cx="20" cy="21" r="1" />
      <Path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </Svg>
  );
}
function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}
function ClipIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </Svg>
  );
}
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <Path d="M22 4L12 14.01l-3-3" />
    </Svg>
  );
}
function CashIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="6" width="20" height="12" rx="2" />
      <Circle cx="12" cy="12" r="2" />
      <Path d="M2 10h20" />
    </Svg>
  );
}
function WechatIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </Svg>
  );
}
function AlipayIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z" />
      <Path d="M10 14l2 2 4-4" />
    </Svg>
  );
}
function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </Svg>
  );
}

const PAY_ICONS: Record<string, React.FC<{ color: string }>> = {
  '现金': CashIcon, '微信': WechatIcon, '支付宝': AlipayIcon,
};
const PAY_KEYS = ['现金', '微信', '支付宝'] as const;
type PayMethod = typeof PAY_KEYS[number];

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },

  // ── Merged Frosted Glass Block (header + search + filters) ──
  frostedBlock: {
    marginHorizontal: 12, marginTop: 4,
    borderRadius: 16, overflow: 'hidden' as const,
    borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    backgroundColor: withAlpha(c.surface, 0.65),
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(24px)',
    // @ts-ignore
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  },
  // Header section inside block
  headerSection: { padding: 16, paddingBottom: 8 },
  headerTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, color: c.textMain },
  headerBadge: { backgroundColor: withAlpha(c.primary, 0.1), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 },
  headerBadgeText: { fontSize: 11, color: c.primary, fontWeight: '600' as const },
  statRow: { flexDirection: 'row' as const, gap: 6 },
  statPill: { flex: 1, backgroundColor: withAlpha(c.textMain, 0.04), borderRadius: 10, padding: 10, alignItems: 'center' as const },
  statNum: { fontSize: 15, fontWeight: '600' as const, color: c.textMain },
  statLbl: { fontSize: 10, color: c.textSub, marginTop: 3 },

  // Search + filters section inside block
  searchSection: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 0.5, borderTopColor: withAlpha(c.textMain, 0.06) },
  searchInput: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.1), borderRadius: 10, fontSize: 14, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), outline: 'none' },
  filterRow: { flexDirection: 'row' as const, gap: 6, marginTop: 8 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12) },
  filterChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterChipText: { fontSize: 12, color: c.textSub },
  filterChipTextOn: { color: c.surface },

  // ── Sub tabs ──
  subTabRow: { flexDirection: 'row' as const, marginTop: 10, marginHorizontal: 12, gap: 2 },
  subTab: { flex: 1, paddingVertical: 9, alignItems: 'center' as const, borderRadius: 10 },
  subTabOn: { backgroundColor: c.primary },
  subTabText: { fontSize: 12, fontWeight: '500' as const, color: c.textSub },
  subTabTextOn: { color: c.surface, fontWeight: '600' as const },

  // ── Product list ──
  sectionHead: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, fontSize: 11, fontWeight: '600' as const, color: c.textSub, textTransform: 'uppercase' as const, letterSpacing: 1 },
  productCard: { marginHorizontal: 12, marginBottom: 6, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06), overflow: 'hidden' as const },
  productCardSel: { borderColor: c.primary, borderWidth: 1.5 },
  prodRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, gap: 10 },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
  prodSpec: { fontSize: 11, color: c.textSub },
  prodPriceWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginRight: 8 },
  prodPrice: { fontSize: 14, fontWeight: '600' as const, color: c.primary },
  qtyRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyBtnMinus: { backgroundColor: withAlpha(c.textMain, 0.06) },
  qtyBtnMinusText: { fontSize: 18, color: c.textSub },
  qtyBtnPlus: { backgroundColor: c.primary },
  qtyBtnPlusText: { fontSize: 18, color: c.surface, fontWeight: '300' as const },
  qtyNum: { width: 36, textAlign: 'center' as const, fontSize: 14, fontWeight: '600' as const, color: c.textMain },
  prodSubtotal: { paddingHorizontal: 12, paddingBottom: 8, fontSize: 11, color: c.primary, fontWeight: '500' as const },

  // ── Cart bar ──
  cartBar: {
    position: 'absolute' as const, bottom: 82, left: 0, right: 0, zIndex: 100,
    marginHorizontal: 12,
    backgroundColor: withAlpha(c.surface, 0.95),
    borderRadius: 14,
    borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(20px)',
  },
  cartPreview: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 12 },
  cartIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadge: { position: 'absolute' as const, top: -4, right: -4, width: 18, height: 18, backgroundColor: c.warning, borderRadius: 9, borderWidth: 2, borderColor: c.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadgeText: { fontSize: 10, fontWeight: '600' as const, color: c.surface },
  cartInfo: { flex: 1 },
  cartInfoText: { fontSize: 12, color: c.textSub },
  cartInfoBold: { fontWeight: '600' as const, color: c.textMain },
  cartTotal: { fontSize: 18, fontWeight: '700' as const, color: c.primary },

  // ── Drawer ──
  overlay: { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 200 },
  drawer: { position: 'fixed' as any, bottom: 0, left: 0, right: 0, backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' as any, zIndex: 201, display: 'flex' as any, flexDirection: 'column' as any },
  drawerHandle: { width: 36, height: 4, backgroundColor: withAlpha(c.textMain, 0.15), borderRadius: 2, alignSelf: 'center' as const, marginTop: 10 },
  drawerHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 12, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.08) },
  drawerHeadTitle: { fontSize: 16, fontWeight: '600' as const, color: c.textMain },
  drawerClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(c.textMain, 0.06), alignItems: 'center' as const, justifyContent: 'center' as const },
  drawerCloseText: { fontSize: 18, color: c.textSub },
  drawerBody: { padding: 16, overflow: 'scroll' as any, flex: 1 } as any,

  fieldGrid: { flexDirection: 'row' as const, gap: 10, flexWrap: 'wrap' as const },
  field: { flex: 1, minWidth: 100, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '500' as const, color: c.textSub, marginBottom: 5 },
  fieldInput: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, fontSize: 13, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), outline: 'none' },

  payChips: { flexDirection: 'row' as const, gap: 6 },
  payChip: { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, alignItems: 'center' as const },
  payChipOn: { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.08) },
  payChipText: { fontSize: 12, fontWeight: '500' as const, color: c.textSub },
  payChipTextOn: { color: c.primary, fontWeight: '600' as const },

  uploadArea: { borderWidth: 1.5, borderColor: withAlpha(c.textMain, 0.12), borderStyle: 'dashed' as any, borderRadius: 12, padding: 16, alignItems: 'center' as const, cursor: 'pointer' as any },
  receiptPreview: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 8 },
  receiptThumb: { width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.08) },

  drawerItemsTitle: { fontSize: 11, fontWeight: '600' as const, color: c.textSub, paddingVertical: 10 },
  drawerItemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.05) },
  drawerItemName: { flex: 1, fontSize: 13, color: c.textMain },
  drawerItemQty: { fontSize: 12, color: c.textSub },
  drawerItemAmount: { fontSize: 13, fontWeight: '600' as const, color: c.primary },
  drawerTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingTop: 12, marginTop: 8, borderTopWidth: 2, borderTopColor: withAlpha(c.textMain, 0.12) },
  drawerTotalLabel: { fontSize: 13, color: c.textSub },
  drawerTotal: { fontSize: 20, fontWeight: '700' as const, color: c.primary },

  submitBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' as const, marginTop: 16 },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: c.surface, fontSize: 15, fontWeight: '600' as const },

  // ── Product mgmt ──
  mgmtRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 12, marginHorizontal: 12, marginBottom: 6, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06) },
  mgmtInfo: { flex: 1 },
  mgmtName: { fontSize: 13, fontWeight: '500' as const, color: c.textMain },
  mgmtMeta: { fontSize: 11, color: c.textSub, marginTop: 2 },
  mgmtActions: { flexDirection: 'row' as const, gap: 8 },
  mgmtActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: withAlpha(c.textMain, 0.05) },
  mgmtAddBtn: { marginHorizontal: 12, marginTop: 8, marginBottom: 16, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.primary, 0.2), paddingVertical: 12, alignItems: 'center' as const },
  mgmtAddBtnText: { fontSize: 13, fontWeight: '600' as const, color: c.primary },

  // ── Modal (matching HomeScreen bg settings modal) ──
  modalOverlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 400, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center' as const, alignItems: 'center' as const },
  modalCard: { backgroundColor: c.surface, borderRadius: 16, width: 340, maxWidth: '90%' as any, overflow: 'hidden' as const },
  modalHeader: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  modalTitle: { fontSize: 14, fontWeight: '700' as const, color: c.surface },
  modalClose: { fontSize: 18, color: withAlpha(c.surface, 0.7), fontWeight: '300' as const },
  modalBody: { padding: 24 },
  modalInput: { paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, fontSize: 13, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), marginBottom: 10, outline: 'none' },
  modalBtnRow: { flexDirection: 'row' as const, gap: 8, marginTop: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: withAlpha(c.textMain, 0.06), alignItems: 'center' as const },
  modalBtnCancelText: { fontSize: 13, color: c.textSub, fontWeight: '500' as const },
  modalBtnConfirm: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center' as const },
  modalBtnConfirmText: { fontSize: 13, color: c.surface, fontWeight: '600' as const },

  // ── History ──
  historyList: { padding: 12, paddingBottom: 100 },
  historyCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06), marginBottom: 10, overflow: 'hidden' as const },
  histHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 10, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.05) },
  histNo: { fontSize: 12, fontWeight: '600' as const, color: c.primary },
  histDate: { fontSize: 11, color: c.textSub },
  histBody: { padding: 10 },
  histRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  histRowLabel: { fontSize: 12, color: c.textSub },
  histRowVal: { fontSize: 12, fontWeight: '500' as const, color: c.textMain },
  histPayBadge: { alignSelf: 'flex-start' as const, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withAlpha(c.primary, 0.08), borderRadius: 12, marginTop: 4 },
  histPayText: { fontSize: 11, fontWeight: '500' as const, color: c.primary },
  histAmount: { fontSize: 18, fontWeight: '700' as const, color: c.primary, marginTop: 8 },
  histImages: { flexDirection: 'row' as const, gap: 4, marginTop: 6 },

  // ── Success ──
  successOverlay: { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 400, alignItems: 'center' as const, justifyContent: 'center' as const },
  successCard: { backgroundColor: c.surface, borderRadius: 20, padding: 28, width: 'calc(100% - 40px)' as any, maxWidth: 320, alignItems: 'center' as const },
  successTitle: { fontSize: 18, fontWeight: '700' as const, color: c.textMain, marginBottom: 6, marginTop: 8 },
  successSub: { fontSize: 14, color: c.textSub, lineHeight: 20 } as any,
  successAmount: { fontSize: 28, fontWeight: '700' as const, color: c.primary, marginVertical: 12 },
  successBtns: { flexDirection: 'row' as const, gap: 8, marginTop: 16 },
  successBtnNew: { flex: 1, paddingVertical: 12, backgroundColor: c.primary, borderRadius: 12, alignItems: 'center' as const },
  successBtnNewText: { color: c.surface, fontSize: 14, fontWeight: '600' as const },
  successBtnView: { flex: 1, paddingVertical: 12, backgroundColor: withAlpha(c.textMain, 0.06), borderRadius: 12, alignItems: 'center' as const },
  successBtnViewText: { color: c.textSub, fontSize: 14, fontWeight: '500' as const },

  // ── Empty state (matching app pattern: title + hint) ──
  emptyWrap: { alignItems: 'center' as const, paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '500' as const, color: c.textSub, marginBottom: 6 },
  emptyHint: { fontSize: 13, color: c.textSub, textAlign: 'center' as const, paddingHorizontal: 40, lineHeight: 20 },

  loadingWrap: { paddingVertical: 20, alignItems: 'center' as const },
  contentArea: { flex: 1, paddingBottom: 100 },

  // Chip icon circle (matching ExpenseScreen)
  chipIconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center' as const, justifyContent: 'center' as const },
});

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
export default function ProcurementScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [subTab, setSubTab] = useState<SubTab>('new');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('全部');
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceVal, setEditPriceVal] = useState('');

  const [showDrawer, setShowDrawer] = useState(false);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<PayMethod>('微信');
  const [orderNote, setOrderNote] = useState('');
  const [receipts, setReceipts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [successTotal, setSuccessTotal] = useState(0);
  const [successBatch, setSuccessBatch] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const [stats, setStats] = useState<ProcStats>({ total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 });

  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [loadingHist, setLoadingHist] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({ name: '', spec: '', price: '', supplier: '' });

  const suppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean));
    return ['全部', ...Array.from(set)];
  }, [products]);

  const loadProducts = useCallback(() => {
    api.getProducts().then((data: any) => { if (Array.isArray(data)) setProducts(data); }).catch(() => {});
  }, []);
  const loadStats = useCallback(() => {
    api.getProcurementStats().then((s: any) => { if (s) setStats(s); }).catch(() => {});
  }, []);

  useEffect(() => { loadProducts(); loadStats(); }, [loadProducts, loadStats]);

  useEffect(() => {
    if (subTab !== 'history') return;
    setLoadingHist(true);
    api.getProcurementBatches(1).then((data: any) => {
      setBatches(data.records || []); setHistTotal(data.total || 0); setHistPage(1);
    }).catch(() => {}).finally(() => setLoadingHist(false));
  }, [subTab]);

  const loadMoreHistory = () => {
    if (loadingHist) return;
    const next = histPage + 1;
    setLoadingHist(true);
    api.getProcurementBatches(next).then((data: any) => {
      setBatches(prev => [...prev, ...(data.records || [])]); setHistPage(next);
    }).catch(() => {}).finally(() => setLoadingHist(false));
  };

  const filteredProducts = useMemo(() => {
    let list = products;
    if (supplierFilter !== '全部') list = list.filter(p => p.supplier === supplierFilter);
    if (search) list = list.filter(p => p.name.includes(search));
    return list;
  }, [products, supplierFilter, search]);

  const groupedProducts = useMemo(() => {
    const map: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      const sup = p.supplier || t('procAll');
      if (!map[sup]) map[sup] = [];
      map[sup].push(p);
    });
    return map;
  }, [filteredProducts]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const product = products.find(p => p.id === Number(pid));
        if (!product) return null;
        return { product, quantity: qty, subtotal: product.price * qty };
      }).filter(Boolean) as CartItem[];
  }, [cart, products]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.subtotal, 0), [cartItems]);
  const cartCount = cartItems.length;

  const updateQty = (pid: number, delta: number) => {
    setCart(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) + delta) }));
  };

  const startEditPrice = (pid: number) => {
    const p = products.find(x => x.id === pid);
    if (p) { setEditingPrice(pid); setEditPriceVal(String(p.price)); }
  };

  const commitPrice = (pid: number) => {
    const val = parseFloat(editPriceVal);
    if (!isNaN(val) && val > 0) {
      api.updateProduct({ id: pid, name: products.find(p => p.id === pid)?.name, price: val }).then((r: any) => {
        if (r.status === 'ok') setProducts(prev => prev.map(p => p.id === pid ? { ...p, price: val } : p));
      }).catch(() => {});
    }
    setEditingPrice(null);
  };

  const handleFileUpload = async (e: any) => {
    const files = e.target?.files || e.nativeEvent?.target?.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files) as File[]) {
      const form = new FormData(); form.append('files', file);
      try {
        const resp = await fetch('/api/expenses/upload-images', { method: 'POST', body: form, headers: { 'X-Lang': 'zh-CN' } });
        const j = await resp.json();
        if (j.images) setReceipts(prev => [...prev, ...j.images]);
      } catch {}
    }
    setUploading(false);
  };

  const submitOrder = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const r = await api.createProcurementBatch({
        date: orderDate, payment_method: payMethod, category: t('procPurchase'),
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        images: receipts, note: orderNote,
      });
      if (r.status === 'ok') {
        setSuccessTotal(r.total); setSuccessBatch(r.batch_number); setShowSuccess(true);
        setCart({}); setReceipts([]); setOrderNote(''); setShowDrawer(false);
        loadStats();
      }
    } catch {}
    setSubmitting(false);
  };

  const resetOrder = () => {
    setShowSuccess(false);
    setOrderDate(new Date().toISOString().slice(0, 10));
    setPayMethod('微信'); setOrderNote(''); setReceipts([]);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProdForm({ name: '', spec: '', price: '', supplier: '' });
    setShowProductModal(true);
  };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdForm({ name: p.name, spec: p.spec, price: String(p.price), supplier: p.supplier });
    setShowProductModal(true);
  };
  const saveProduct = async () => {
    if (!prodForm.name) return;
    const data = { name: prodForm.name, spec: prodForm.spec, price: parseFloat(prodForm.price) || 0, supplier: prodForm.supplier };
    editingProduct ? await api.updateProduct({ ...data, id: editingProduct.id }) : await api.createProduct(data);
    setShowProductModal(false);
    loadProducts();
  };
  const deleteProduct = async (p: Product) => {
    await api.deleteProduct(p.id);
    loadProducts();
  };

  const ChipIcon = PAY_ICONS[payMethod] || CashIcon;

  return (
    <View style={styles.container}>
      {/* ── Merged Frosted Glass Block (header + search + filters) ── */}
      <View style={styles.frostedBlock}>
        {/* Header stats */}
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>{t('procurement')}</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{t('procNowBatch').replace('{n}', String(stats.batch_count + 1))}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{stats.batch_count}</Text>
              <Text style={styles.statLbl}>{t('procBatchCount')}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>¥{stats.total_spent.toFixed(0)}</Text>
              <Text style={styles.statLbl}>{t('procCumulative')}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{stats.margin_pct}%</Text>
              <Text style={styles.statLbl}>{t('procMargin')}</Text>
            </View>
          </View>
        </View>

        {/* Search + filters */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('procSearchPlaceholder')}
            placeholderTextColor={c.textSub}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 6 }}>
            {suppliers.map(sup => (
              <TouchableOpacity key={sup} style={[styles.filterChip, supplierFilter === sup && styles.filterChipOn]} onPress={() => setSupplierFilter(sup)}>
                <Text style={[styles.filterChipText, supplierFilter === sup && styles.filterChipTextOn]}>{sup}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={styles.subTabRow}>
        <TouchableOpacity style={[styles.subTab, subTab === 'new' && styles.subTabOn]} onPress={() => setSubTab('new')}>
          <Text style={[styles.subTabText, subTab === 'new' && styles.subTabTextOn]}>{t('procNewOrder')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, subTab === 'history' && styles.subTabOn]} onPress={() => setSubTab('history')}>
          <Text style={[styles.subTabText, subTab === 'history' && styles.subTabTextOn]}>{t('procHistory')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, subTab === 'products' && styles.subTabOn]} onPress={() => setSubTab('products')}>
          <Text style={[styles.subTabText, subTab === 'products' && styles.subTabTextOn]}>{t('procProductMgmt')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── New Order ── */}
      {subTab === 'new' && (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
            {Object.entries(groupedProducts).map(([sup, items]) => (
              <View key={sup}>
                <Text style={styles.sectionHead}>{sup}</Text>
                {items.map(p => {
                  const qty = cart[p.id] || 0;
                  const isEditing = editingPrice === p.id;
                  return (
                    <View key={p.id} style={[styles.productCard, qty > 0 && styles.productCardSel]}>
                      <View style={styles.prodRow}>
                        <View style={styles.prodInfo}>
                          <Text style={styles.prodName}>{p.name}</Text>
                          <Text style={styles.prodSpec}>{p.spec}</Text>
                        </View>
                        <View style={styles.prodPriceWrap}>
                          {isEditing ? (
                            <TextInput
                              style={{ width: 70, fontSize: 13, fontWeight: '600', color: c.primary, borderWidth: 1, borderColor: c.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, outline: 'none', backgroundColor: c.surface } as any}
                              value={editPriceVal} onChangeText={setEditPriceVal}
                              onBlur={() => commitPrice(p.id)} autoFocus keyboardType="numeric"
                            />
                          ) : (
                            <>
                              <Text style={styles.prodPrice}>¥{p.price}</Text>
                              <TouchableOpacity onPress={() => startEditPrice(p.id)} style={{ padding: 2 }}>
                                <PencilIcon color={c.textSub} />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <View style={styles.qtyRow}>
                          <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnMinus]} onPress={() => updateQty(p.id, -1)}>
                            <Text style={styles.qtyBtnMinusText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyNum}>{qty}</Text>
                          <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={() => updateQty(p.id, 1)}>
                            <Text style={styles.qtyBtnPlusText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {qty > 0 && <Text style={styles.prodSubtotal}>{t('procSubtotal')} ¥{(p.price * qty).toFixed(2)}</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {cartCount > 0 && (
            <View style={styles.cartBar}>
              <TouchableOpacity style={styles.cartPreview} onPress={() => setShowDrawer(true)} activeOpacity={0.8}>
                <View style={[styles.cartIconWrap, { backgroundColor: c.primary }]}>
                  <CartIcon color={c.surface} />
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                </View>
                <View style={styles.cartInfo}>
                  <Text style={styles.cartInfoText}>{t('procCartCount').replace('{n}', String(cartCount))}</Text>
                </View>
                <Text style={styles.cartTotal}>¥{cartTotal.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── History ── */}
      {subTab === 'history' && (
        <FlatList
          data={batches}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.historyList}
          onEndReached={batches.length < histTotal ? loadMoreHistory : undefined}
          onEndReachedThreshold={0.4}
          renderItem={({ item: batch }) => (
            <View style={styles.historyCard}>
              <View style={styles.histHead}>
                <Text style={styles.histNo}>{t('procNowBatch').replace('{n}', String(batch.batch_number))}</Text>
                <Text style={styles.histDate}>{batch.date}</Text>
              </View>
              <View style={styles.histBody}>
                <View style={styles.histRow}>
                  <Text style={styles.histRowLabel}>{t('procOrderItems')}</Text>
                  <Text style={styles.histRowVal}>{batch.items?.length || 0} 种</Text>
                </View>
                <View style={styles.histRow}>
                  <Text style={styles.histRowLabel}>{t('procPaymentMethod')}</Text>
                  <Text style={styles.histRowVal}>{batch.payment_method}</Text>
                </View>
                {batch.note ? (
                  <View style={styles.histRow}>
                    <Text style={styles.histRowLabel}>{t('procNoteOptional')}</Text>
                    <Text style={styles.histRowVal}>{batch.note}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: c.textSub }}>{t('procThisBatch')}</Text>
                  <Text style={styles.histAmount}>¥{batch.total.toFixed(2)}</Text>
                </View>
                {batch.images?.length > 0 && (
                  <View style={styles.histImages}>
                    {batch.images.map((img, i) => <Image key={i} source={{ uri: img }} style={styles.receiptThumb} />)}
                  </View>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('noRecords')}</Text>
              <Text style={styles.emptyHint}>{t('procNoHistory')}</Text>
            </View>
          }
          ListFooterComponent={loadingHist ? <View style={styles.loadingWrap}><ActivityIndicator color={c.primary} /></View> : null}
        />
      )}

      {/* ── Product Mgmt ── */}
      {subTab === 'products' && (
        <ScrollView style={styles.contentArea}>
          <TouchableOpacity style={styles.mgmtAddBtn} onPress={openAddProduct}>
            <Text style={styles.mgmtAddBtnText}>+ {t('procAddProduct')}</Text>
          </TouchableOpacity>
          {products.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('noRecords')}</Text>
              <Text style={styles.emptyHint}>{t('noProducts')}</Text>
            </View>
          ) : (
            products.map(p => (
              <View key={p.id} style={styles.mgmtRow}>
                <View style={styles.mgmtInfo}>
                  <Text style={styles.mgmtName}>{p.name}</Text>
                  <Text style={styles.mgmtMeta}>{p.supplier} · {p.spec} · ¥{p.price}</Text>
                </View>
                <View style={styles.mgmtActions}>
                  <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => openEditProduct(p)}>
                    <PencilIcon color={c.textSub} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => deleteProduct(p)}>
                    <TrashIcon color={c.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Product Modal (matching app standard: primary header) ── */}
      {showProductModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? t('procEditProduct') : t('procAddProduct')}</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput style={styles.modalInput} placeholder={t('procProductName')} placeholderTextColor={c.textSub} value={prodForm.name} onChangeText={v => setProdForm(p => ({ ...p, name: v }))} />
              <TextInput style={styles.modalInput} placeholder={t('procProductSpec')} placeholderTextColor={c.textSub} value={prodForm.spec} onChangeText={v => setProdForm(p => ({ ...p, spec: v }))} />
              <TextInput style={styles.modalInput} placeholder={t('procProductSupplier')} placeholderTextColor={c.textSub} value={prodForm.supplier} onChangeText={v => setProdForm(p => ({ ...p, supplier: v }))} />
              <TextInput style={styles.modalInput} placeholder={t('procProductPrice')} placeholderTextColor={c.textSub} value={prodForm.price} onChangeText={v => setProdForm(p => ({ ...p, price: v }))} keyboardType="numeric" />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowProductModal(false)}>
                  <Text style={styles.modalBtnCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnConfirm} onPress={saveProduct}>
                  <Text style={styles.modalBtnConfirmText}>{t('procSubmit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── Order Drawer ── */}
      {showDrawer && (
        <>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDrawer(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHandle} />
            <View style={styles.drawerHead}>
              <Text style={styles.drawerHeadTitle}>{t('procConfirmOrder')}</Text>
              <TouchableOpacity style={styles.drawerClose} onPress={() => setShowDrawer(false)}>
                <Text style={styles.drawerCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.drawerBody}>
              <View style={styles.fieldGrid}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('procOrderDate')}</Text>
                  <input type="date" value={orderDate} onChange={e => setOrderDate((e.target as HTMLInputElement).value)}
                    style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box' } as any} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('expenseCategory')}</Text>
                  <input type="text" value={t('procPurchase')} readOnly
                    style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box', opacity: 0.6 } as any} />
                </View>
              </View>

              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>{t('procPaymentMethod')}</Text>
                <View style={styles.payChips}>
                  {PAY_KEYS.map(pm => {
                    const Icon = PAY_ICONS[pm];
                    const active = payMethod === pm;
                    const chipColor = active ? c.surface : c.textSub;
                    return (
                      <TouchableOpacity key={pm} style={[styles.payChip, active && styles.payChipOn]} onPress={() => setPayMethod(pm)}>
                        <View style={[styles.chipIconCircle, active && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                          <Icon color={chipColor} />
                        </View>
                        <Text style={[styles.payChipText, active && styles.payChipTextOn, { marginTop: 4 }]}>{pm}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>{t('procUploadReceipt')}</Text>
                <label style={styles.uploadArea as any}>
                  <input type="file" accept="image/*" multiple onChange={handleFileUpload}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  <ClipIcon color={c.textSub} />
                  <Text style={{ fontSize: 12, color: c.textSub, marginTop: 6 }}>{t('procUploadHint')}</Text>
                </label>
                {receipts.length > 0 && (
                  <View style={styles.receiptPreview}>
                    {receipts.map((r, i) => <Image key={i} source={{ uri: r }} style={styles.receiptThumb} />)}
                  </View>
                )}
                {uploading && <ActivityIndicator color={c.primary} style={{ marginTop: 8 }} />}
              </View>

              <Text style={styles.drawerItemsTitle}>{t('procOrderItems')}</Text>
              {cartItems.map(item => (
                <View key={item.product.id} style={styles.drawerItemRow}>
                  <Text style={styles.drawerItemName}>{item.product.name}</Text>
                  <Text style={styles.drawerItemQty}>×{item.quantity}</Text>
                  <Text style={styles.drawerItemAmount}>¥{item.subtotal.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.drawerTotalRow}>
                <Text style={styles.drawerTotalLabel}>{t('procTotal')}</Text>
                <Text style={styles.drawerTotal}>¥{cartTotal.toFixed(2)}</Text>
              </View>

              <View style={[styles.field, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>{t('procNoteOptional')}</Text>
                <TextInput style={styles.fieldInput} value={orderNote} onChangeText={setOrderNote} placeholder={t('procNoteOptional')} placeholderTextColor={c.textSub} />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, cartCount === 0 && styles.submitBtnDisabled]}
                onPress={submitOrder} disabled={cartCount === 0 || submitting}>
                {submitting ? <ActivityIndicator color={c.surface} /> : <Text style={styles.submitBtnText}>{t('procSubmit')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Success ── */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <CheckIcon color={c.success} />
            <Text style={styles.successTitle}>{t('procSubmitted')}</Text>
            <Text style={styles.successSub}>{t('procSubmittedMsg')}</Text>
            <Text style={styles.successAmount}>¥{successTotal.toFixed(2)}</Text>
            <Text style={{ fontSize: 12, color: c.textSub }}>
              {t('procNowBatch').replace('{n}', String(successBatch))} · {orderDate} · {payMethod}
            </Text>
            <View style={styles.successBtns}>
              <TouchableOpacity style={styles.successBtnNew} onPress={resetOrder}>
                <Text style={styles.successBtnNewText}>{t('procContinue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.successBtnView} onPress={() => { setShowSuccess(false); setSubTab('history'); }}>
                <Text style={styles.successBtnViewText}>{t('procViewRecords')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
