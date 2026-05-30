import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  FlatList, Modal, Image, ActivityIndicator, StyleSheet
} from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { t } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';

type SubTab = 'new' | 'history' | 'products';
type PayMethod = '微信' | '现金' | '支付宝';

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

const PAY_ICONS: Record<PayMethod, string> = { '现金': '💵', '微信': '💚', '支付宝': '🔵' };
const PAY_KEYS: PayMethod[] = ['现金', '微信', '支付宝'];

// ── Styles ──
const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  // Frosted glass header
  header: {
    backgroundColor: withAlpha(c.surface, 0.65),
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(24px)',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 4,
    padding: 16,
    borderWidth: 0.5,
    borderColor: withAlpha(c.textMain, 0.08),
  },
  headerTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, color: c.textMain },
  headerBadge: { backgroundColor: withAlpha(c.primary, 0.1), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 },
  headerBadgeText: { fontSize: 11, color: c.primary, fontWeight: '600' as const },
  statRow: { flexDirection: 'row' as const, gap: 8 },
  statPill: { flex: 1, backgroundColor: withAlpha(c.textMain, 0.04), borderRadius: 10, padding: 10, alignItems: 'center' as const },
  statNum: { fontSize: 15, fontWeight: '600' as const, color: c.textMain },
  statLbl: { fontSize: 10, color: c.textSub, marginTop: 3 },

  // Sub tabs
  subTabRow: { flexDirection: 'row' as const, marginTop: 10, marginHorizontal: 12, gap: 2 },
  subTab: { flex: 1, paddingVertical: 9, alignItems: 'center' as const, borderRadius: 10, backgroundColor: 'transparent' },
  subTabOn: { backgroundColor: c.primary },
  subTabText: { fontSize: 12, fontWeight: '500' as const, color: c.textSub },
  subTabTextOn: { color: c.surface, fontWeight: '600' as const },

  searchBar: { paddingHorizontal: 12, paddingTop: 10 },
  searchInput: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.1), borderRadius: 10, fontSize: 14, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), outline: 'none' },
  filterScroll: { marginTop: 8, marginBottom: 2 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12) },
  filterChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterChipText: { fontSize: 12, color: c.textSub },
  filterChipTextOn: { color: c.surface },

  sectionHead: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, fontSize: 11, fontWeight: '600' as const, color: c.textSub, textTransform: 'uppercase' as const, letterSpacing: 1 },
  productCard: { marginHorizontal: 12, marginBottom: 6, backgroundColor: withAlpha(c.surface, 0.9), borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06), overflow: 'hidden' as const },
  productCardSel: { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.04) },
  prodRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, gap: 10 },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
  prodSpec: { fontSize: 11, color: c.textSub },
  prodPriceWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginRight: 8 },
  prodPrice: { fontSize: 14, fontWeight: '600' as const, color: c.primary },
  priceEditBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  priceEditBtnText: { fontSize: 13, color: c.textSub },
  qtyRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyBtnMinus: { backgroundColor: withAlpha(c.textMain, 0.06) },
  qtyBtnMinusText: { fontSize: 18, color: c.textSub },
  qtyBtnPlus: { backgroundColor: c.primary },
  qtyBtnPlusText: { fontSize: 18, color: c.surface, fontWeight: '300' as const },
  qtyNum: { width: 36, textAlign: 'center' as const, fontSize: 14, fontWeight: '600' as const, color: c.textMain },
  prodSubtotal: { paddingHorizontal: 12, paddingBottom: 8, fontSize: 11, color: c.primary, fontWeight: '500' as const },

  // Cart bar
  cartBar: { backgroundColor: withAlpha(c.surface, 0.95), borderTopWidth: 1, borderTopColor: withAlpha(c.textMain, 0.08), position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingBottom: 0, zIndex: 100,
    // @ts-ignore
    backdropFilter: 'saturate(180%) blur(20px)',
  },
  cartPreview: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 12 },
  cartIconWrap: { width: 40, height: 40, backgroundColor: c.primary, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadge: { position: 'absolute' as const, top: -4, right: -4, width: 18, height: 18, backgroundColor: c.warning, borderRadius: 9, borderWidth: 2, borderColor: c.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadgeText: { fontSize: 10, fontWeight: '600' as const, color: c.surface },
  cartIcon: { fontSize: 18 },
  cartInfo: { flex: 1 },
  cartInfoText: { fontSize: 12, color: c.textSub },
  cartInfoBold: { fontWeight: '600' as const, color: c.textMain },
  cartTotal: { fontSize: 18, fontWeight: '700' as const, color: c.primary },

  // Drawer
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
  uploadIcon: { fontSize: 24, marginBottom: 4, color: c.textSub },
  uploadText: { fontSize: 12, color: c.textSub },
  uploadTextAccent: { color: c.primary, fontWeight: '500' as const },
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

  // Product mgmt
  mgmtRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 12, marginHorizontal: 12, marginBottom: 6, backgroundColor: withAlpha(c.surface, 0.9), borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06) },
  mgmtInfo: { flex: 1 },
  mgmtName: { fontSize: 13, fontWeight: '500' as const, color: c.textMain },
  mgmtMeta: { fontSize: 11, color: c.textSub, marginTop: 2 },
  mgmtActions: { flexDirection: 'row' as const, gap: 6 },
  mgmtActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12) },
  mgmtActionText: { fontSize: 11, fontWeight: '500' as const, color: c.textSub },
  mgmtAddBtn: { marginHorizontal: 12, marginTop: 8, marginBottom: 16, backgroundColor: withAlpha(c.primary, 0.08), borderRadius: 12, paddingVertical: 12, alignItems: 'center' as const, borderWidth: 1, borderColor: withAlpha(c.primary, 0.15) },
  mgmtAddBtnText: { fontSize: 13, fontWeight: '600' as const, color: c.primary },

  // Modal (generic)
  modalOverlay: { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 400, alignItems: 'center' as const, justifyContent: 'center' as const },
  modalCard: { backgroundColor: c.surface, borderRadius: 16, width: 'calc(100% - 40px)' as any, maxWidth: 360, padding: 24 },
  modalTitle: { fontSize: 16, fontWeight: '700' as const, color: c.textMain, marginBottom: 16 },
  modalInput: { paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, fontSize: 13, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), marginBottom: 10, outline: 'none' },
  modalBtnRow: { flexDirection: 'row' as const, gap: 8, marginTop: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: withAlpha(c.textMain, 0.06), alignItems: 'center' as const },
  modalBtnCancelText: { fontSize: 13, color: c.textSub, fontWeight: '500' as const },
  modalBtnConfirm: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center' as const },
  modalBtnConfirmText: { fontSize: 13, color: c.surface, fontWeight: '600' as const },

  // History
  historyList: { padding: 12, paddingBottom: 80 },
  historyCard: { backgroundColor: withAlpha(c.surface, 0.9), borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06), marginBottom: 10, overflow: 'hidden' as const },
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

  // Success modal
  successOverlay: { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 400, alignItems: 'center' as const, justifyContent: 'center' as const },
  successCard: { backgroundColor: c.surface, borderRadius: 20, padding: 28, width: 'calc(100% - 40px)' as any, maxWidth: 320, alignItems: 'center' as const },
  successIcon: { fontSize: 52, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700' as const, color: c.textMain, marginBottom: 6 },
  successSub: { fontSize: 14, color: c.textSub, lineHeight: 20 } as any,
  successAmount: { fontSize: 28, fontWeight: '700' as const, color: c.primary, marginVertical: 12 },
  successBtns: { flexDirection: 'row' as const, gap: 8, marginTop: 16 },
  successBtnNew: { flex: 1, paddingVertical: 12, backgroundColor: c.primary, borderRadius: 12, alignItems: 'center' as const },
  successBtnNewText: { color: c.surface, fontSize: 14, fontWeight: '600' as const },
  successBtnView: { flex: 1, paddingVertical: 12, backgroundColor: withAlpha(c.textMain, 0.06), borderRadius: 12, alignItems: 'center' as const },
  successBtnViewText: { color: c.textSub, fontSize: 14, fontWeight: '500' as const },

  emptyText: { textAlign: 'center' as const, paddingVertical: 48, color: c.textSub, fontSize: 13 },
  loadingWrap: { paddingVertical: 20, alignItems: 'center' as const },
  contentArea: { flex: 1, paddingBottom: 80 },
});

// ═══════════════════════════════════════════════════════════
// SVG icon for the header
// ═══════════════════════════════════════════════════════════
function ProcurementIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <Path d="M3 6h18" />
      <Path d="M16 10a4 4 0 01-8 0" />
      <Line x1="12" y1="14" x2="12" y2="18" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════
export default function ProcurementScreen({ onBack }: { onBack?: () => void }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  // ── State ──
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

  // Stats
  const [stats, setStats] = useState<ProcStats>({ total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 });

  // History
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [loadingHist, setLoadingHist] = useState(false);

  // Product mgmt
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({ name: '', spec: '', price: '', supplier: '' });

  // ── Suppliers ──
  const suppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean));
    return ['全部', ...Array.from(set)];
  }, [products]);

  // ── Load data ──
  const loadProducts = useCallback(() => {
    api.getProducts().then((data: any) => {
      if (Array.isArray(data)) setProducts(data);
    }).catch(() => {});
  }, []);
  const loadStats = useCallback(() => {
    api.getProcurementStats().then((s: any) => {
      if (s) setStats(s);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadProducts(); loadStats(); }, [loadProducts, loadStats]);

  useEffect(() => {
    if (subTab !== 'history') return;
    setLoadingHist(true);
    api.getProcurementBatches(1).then((data: any) => {
      setBatches(data.records || []);
      setHistTotal(data.total || 0);
      setHistPage(1);
    }).catch(() => {}).finally(() => setLoadingHist(false));
  }, [subTab]);

  const loadMoreHistory = () => {
    if (loadingHist) return;
    const next = histPage + 1;
    setLoadingHist(true);
    api.getProcurementBatches(next).then((data: any) => {
      setBatches(prev => [...prev, ...(data.records || [])]);
      setHistPage(next);
    }).catch(() => {}).finally(() => setLoadingHist(false));
  };

  // ── Derived ──
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
      })
      .filter(Boolean) as CartItem[];
  }, [cart, products]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.subtotal, 0), [cartItems]);
  const cartCount = cartItems.length;

  // ── Handlers ──
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
        if (r.status === 'ok') {
          setProducts(prev => prev.map(p => p.id === pid ? { ...p, price: val } : p));
        }
      }).catch(() => {});
    }
    setEditingPrice(null);
  };

  const handleFileUpload = async (e: any) => {
    const files = e.target?.files || e.nativeEvent?.target?.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files) as File[]) {
      const form = new FormData();
      form.append('files', file);
      try {
        const resp = await fetch('/api/expenses/upload-images', {
          method: 'POST', body: form,
          headers: { 'X-Lang': 'zh-CN' },
        });
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
        date: orderDate,
        payment_method: payMethod,
        category: t('procPurchase'),
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        images: receipts,
        note: orderNote,
      });
      if (r.status === 'ok') {
        setSuccessTotal(r.total);
        setSuccessBatch(r.batch_number);
        setShowSuccess(true);
        setCart({});
        setReceipts([]);
        setOrderNote('');
        setShowDrawer(false);
        loadStats();
      }
    } catch {}
    setSubmitting(false);
  };

  const resetOrder = () => {
    setShowSuccess(false);
    setOrderDate(new Date().toISOString().slice(0, 10));
    setPayMethod('微信');
    setOrderNote('');
    setReceipts([]);
  };

  // ── Product mgmt handlers ──
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
    if (editingProduct) {
      await api.updateProduct({ ...data, id: editingProduct.id });
    } else {
      await api.createProduct(data);
    }
    setShowProductModal(false);
    loadProducts();
  };
  const deleteProduct = async (p: Product) => {
    await api.deleteProduct(p.id);
    loadProducts();
  };

  // ── Render ──
  return (
    <View style={styles.container}>
      {/* Header — frosted glass, rounded, no back button */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ProcurementIcon color={c.primary} />
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

      {/* ── New Order Tab ── */}
      {subTab === 'new' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('procSearchPlaceholder')}
              placeholderTextColor={c.textSub}
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 6 }}>
              {suppliers.map(sup => (
                <TouchableOpacity key={sup} style={[styles.filterChip, supplierFilter === sup && styles.filterChipOn]} onPress={() => setSupplierFilter(sup)}>
                  <Text style={[styles.filterChipText, supplierFilter === sup && styles.filterChipTextOn]}>{sup}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
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
                              style={{ width: 70, fontSize: 13, fontWeight: '600', color: c.primary, borderWidth: 1, borderColor: c.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, outline: 'none' } as any}
                              value={editPriceVal}
                              onChangeText={setEditPriceVal}
                              onBlur={() => commitPrice(p.id)}
                              autoFocus
                              keyboardType="numeric"
                            />
                          ) : (
                            <>
                              <Text style={styles.prodPrice}>¥{p.price}</Text>
                              <TouchableOpacity style={styles.priceEditBtn} onPress={() => startEditPrice(p.id)}>
                                <Text style={styles.priceEditBtnText}>✏️</Text>
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
                      {qty > 0 && (
                        <Text style={styles.prodSubtotal}>{t('procSubtotal')} ¥{(p.price * qty).toFixed(2)}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {cartCount > 0 && (
            <View style={styles.cartBar}>
              <TouchableOpacity style={styles.cartPreview} onPress={() => setShowDrawer(true)} activeOpacity={0.8}>
                <View style={styles.cartIconWrap}>
                  <Text style={styles.cartIcon}>🛒</Text>
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

      {/* ── History Tab ── */}
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
                    <Text style={styles.histRowLabel}>{t('notePlaceholder').split('：')[0] || '备注'}</Text>
                    <Text style={styles.histRowVal}>{batch.note}</Text>
                  </View>
                ) : null}
                <View style={styles.histPayBadge}>
                  <Text style={styles.histPayText}>{batch.payment_method}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: c.textSub }}>{t('procThisBatch')}</Text>
                  <Text style={styles.histAmount}>¥{batch.total.toFixed(2)}</Text>
                </View>
                {batch.images?.length > 0 && (
                  <View style={styles.histImages}>
                    {batch.images.map((img, i) => (
                      <Image key={i} source={{ uri: img }} style={styles.receiptThumb} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('procNoHistory')}</Text>}
          ListFooterComponent={loadingHist ? <View style={styles.loadingWrap}><ActivityIndicator color={c.primary} /></View> : null}
        />
      )}

      {/* ── Product Mgmt Tab ── */}
      {subTab === 'products' && (
        <ScrollView style={styles.contentArea}>
          <TouchableOpacity style={styles.mgmtAddBtn} onPress={openAddProduct}>
            <Text style={styles.mgmtAddBtnText}>+ {t('procAddProduct')}</Text>
          </TouchableOpacity>
          {products.map(p => (
            <View key={p.id} style={styles.mgmtRow}>
              <View style={styles.mgmtInfo}>
                <Text style={styles.mgmtName}>{p.name}</Text>
                <Text style={styles.mgmtMeta}>{p.supplier} · {p.spec} · ¥{p.price}</Text>
              </View>
              <View style={styles.mgmtActions}>
                <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => openEditProduct(p)}>
                  <Text style={styles.mgmtActionText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => deleteProduct(p)}>
                  <Text style={[styles.mgmtActionText, { color: c.danger }]}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Product Form Modal ── */}
      {showProductModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingProduct ? t('procEditProduct') : t('procAddProduct')}</Text>
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
                  <input
                    type="date"
                    value={orderDate}
                    onChange={e => setOrderDate((e.target as HTMLInputElement).value)}
                    style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box' } as any}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('expenseCategory')}</Text>
                  <input type="text" value={t('procPurchase')} readOnly style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box', opacity: 0.6 } as any} />
                </View>
              </View>

              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>{t('procPaymentMethod')}</Text>
                <View style={styles.payChips}>
                  {PAY_KEYS.map(pm => (
                    <TouchableOpacity key={pm} style={[styles.payChip, payMethod === pm && styles.payChipOn]} onPress={() => setPayMethod(pm)}>
                      <Text style={[styles.payChipText, payMethod === pm && styles.payChipTextOn]}>{PAY_ICONS[pm]} {pm}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>{t('procUploadReceipt')}</Text>
                <label style={styles.uploadArea as any}>
                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  <Text style={styles.uploadIcon}>📎</Text>
                  <Text style={styles.uploadText}>
                    {t('procUploadHint')}
                  </Text>
                </label>
                {receipts.length > 0 && (
                  <View style={styles.receiptPreview}>
                    {receipts.map((r, i) => (
                      <Image key={i} source={{ uri: r }} style={styles.receiptThumb} />
                    ))}
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
                onPress={submitOrder}
                disabled={cartCount === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={c.surface} />
                ) : (
                  <Text style={styles.submitBtnText}>{t('procSubmit')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Success Modal ── */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>{t('procSubmitted')}</Text>
            <Text style={styles.successSub}>{t('procSubmittedMsg')}</Text>
            <Text style={styles.successAmount}>¥{successTotal.toFixed(2)}</Text>
            <Text style={{ fontSize: 12, color: c.textSub }}>{t('procNowBatch').replace('{n}', String(successBatch))} · {orderDate} · {payMethod}</Text>
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
