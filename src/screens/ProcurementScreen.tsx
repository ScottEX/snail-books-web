import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  FlatList, Modal, Image, ActivityIndicator
} from 'react-native';
import { t } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';

type SubTab = 'new' | 'history';
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

const PAY_ICONS: Record<PayMethod, string> = { '现金': '💵', '微信': '💚', '支付宝': '🔵' };

// ── Styles ──
const getStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: { backgroundColor: c.primary, paddingVertical: 14, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, color: '#fff' },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' as const },
  statRow: { flexDirection: 'row' as const, gap: 8 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 8, alignItems: 'center' as const },
  statNum: { fontSize: 15, fontWeight: '600' as const, color: '#fff' },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  subTabRow: { flexDirection: 'row' as const, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.08) },
  subTab: { flex: 1, paddingVertical: 11, alignItems: 'center' as const, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabOn: { borderBottomColor: c.primary },
  subTabText: { fontSize: 13, fontWeight: '500' as const, color: c.textSub },
  subTabTextOn: { color: c.primary, fontWeight: '600' as const },

  searchBar: { padding: 12, backgroundColor: c.surface },
  searchInput: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, fontSize: 14, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) },
  filterScroll: { flexDirection: 'row' as const, gap: 6, marginTop: 8, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12) },
  filterChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterChipText: { fontSize: 12, color: c.textSub },
  filterChipTextOn: { color: '#fff' },

  sectionHead: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 11, fontWeight: '600' as const, color: c.textSub, textTransform: 'uppercase' as const, letterSpacing: 1 },
  productCard: { marginHorizontal: 12, marginBottom: 6, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.08), overflow: 'hidden' as const },
  productCardSel: { borderColor: c.primary },
  prodRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, gap: 10 },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
  prodSpec: { fontSize: 11, color: c.textSub },
  prodPriceWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginRight: 8 },
  prodPrice: { fontSize: 14, fontWeight: '600' as const, color: c.primary },
  priceEditBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  priceEditBtnText: { fontSize: 13, color: c.textSub },
  qtyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 0 },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyBtnMinus: { backgroundColor: withAlpha(c.textMain, 0.06) },
  qtyBtnMinusText: { fontSize: 18, color: c.textSub },
  qtyBtnPlus: { backgroundColor: c.primary },
  qtyBtnPlusText: { fontSize: 18, color: '#fff', fontWeight: '300' as const },
  qtyNum: { width: 36, textAlign: 'center' as const, fontSize: 14, fontWeight: '600' as const, color: c.textMain },
  prodSubtotal: { paddingHorizontal: 12, paddingBottom: 8, fontSize: 11, color: c.primary, fontWeight: '500' as const },

  // Cart bar
  cartBar: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: withAlpha(c.textMain, 0.08), position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingBottom: 0, zIndex: 100 },
  cartPreview: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 12 },
  cartIconWrap: { width: 40, height: 40, backgroundColor: c.primary, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadge: { position: 'absolute' as const, top: -4, right: -4, width: 18, height: 18, backgroundColor: c.warning, borderRadius: 9, borderWidth: 2, borderColor: '#fff', alignItems: 'center' as const, justifyContent: 'center' as const },
  cartBadgeText: { fontSize: 10, fontWeight: '600' as const, color: '#fff' },
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
  fieldInput: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.12), borderRadius: 8, fontSize: 13, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03) },

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
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' as const },

  // History
  historyList: { padding: 12 },
  historyCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.08), marginBottom: 10, overflow: 'hidden' as const },
  histHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 10, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.06) },
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
  successCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: 'calc(100% - 40px)' as any, maxWidth: 320, alignItems: 'center' as const },
  successIcon: { fontSize: 52, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700' as const, color: c.textMain, marginBottom: 6 },
  successSub: { fontSize: 14, color: c.textSub, lineHeight: 20 } as any,
  successAmount: { fontSize: 28, fontWeight: '700' as const, color: c.primary, marginVertical: 12 },
  successBtns: { flexDirection: 'row' as const, gap: 8, marginTop: 16 },
  successBtnNew: { flex: 1, paddingVertical: 12, backgroundColor: c.primary, borderRadius: 12, alignItems: 'center' as const },
  successBtnNewText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  successBtnView: { flex: 1, paddingVertical: 12, backgroundColor: withAlpha(c.textMain, 0.06), borderRadius: 12, alignItems: 'center' as const },
  successBtnViewText: { color: c.textSub, fontSize: 14, fontWeight: '500' as const },

  emptyText: { textAlign: 'center' as const, paddingVertical: 48, color: c.textSub, fontSize: 13 },
  loadingWrap: { paddingVertical: 20, alignItems: 'center' as const },
});

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

  // History
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [loadingHist, setLoadingHist] = useState(false);

  // ── Suppliers ──
  const suppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean));
    return ['全部', ...Array.from(set)];
  }, [products]);

  // ── Load products ──
  useEffect(() => {
    api.getProducts().then((data: any) => {
      if (Array.isArray(data)) setProducts(data);
    }).catch(() => {});
  }, []);

  // ── Load history ──
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
      const sup = p.supplier || '其他';
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

  // ── Stats ──
  const uniqueSuppliers = useMemo(() => new Set(products.map(p => p.supplier)).size, [products]);

  // ── Handlers ──
  const updateQty = (pid: number, delta: number) => {
    setCart(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) + delta) }));
  };

  const startEditPrice = (pid: number) => {
    const p = products.find(x => x.id === pid);
    if (p) {
      setEditingPrice(pid);
      setEditPriceVal(String(p.price));
    }
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
        const r = await api.uploadBackground(file as any);
        // uploadBackground returns { url } — use expense upload API
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
        category: '采购',
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

  // ── Render ──
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>← 返回</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>📦 进货管理</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>第 {histTotal + 1} 次进货</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{histTotal}</Text>
            <Text style={styles.statLbl}>历史次数</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>—</Text>
            <Text style={styles.statLbl}>累计货款</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{cartCount}</Text>
            <Text style={styles.statLbl}>本单品类</Text>
          </View>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={styles.subTabRow}>
        <TouchableOpacity style={[styles.subTab, subTab === 'new' && styles.subTabOn]} onPress={() => setSubTab('new')}>
          <Text style={[styles.subTabText, subTab === 'new' && styles.subTabTextOn]}>新建进货</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, subTab === 'history' && styles.subTabOn]} onPress={() => setSubTab('history')}>
          <Text style={[styles.subTabText, subTab === 'history' && styles.subTabTextOn]}>进货记录</Text>
        </TouchableOpacity>
      </View>

      {/* ── New Order Tab ── */}
      {subTab === 'new' && (
        <View style={{ flex: 1 }}>
          {/* Search + Filter */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索商品…"
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

          {/* Product List */}
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
                              style={{ width: 70, fontSize: 13, fontWeight: '600', color: c.primary, borderWidth: 1, borderColor: c.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}
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
                        <Text style={styles.prodSubtotal}>小计 ¥{(p.price * qty).toFixed(2)}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Cart Bar */}
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
                  <Text style={styles.cartInfoText}>已选 <Text style={styles.cartInfoBold}>{cartCount}</Text> 种商品</Text>
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
                <Text style={styles.histNo}>第{batch.batch_number}次进货</Text>
                <Text style={styles.histDate}>{batch.date}</Text>
              </View>
              <View style={styles.histBody}>
                <View style={styles.histRow}>
                  <Text style={styles.histRowLabel}>商品种类</Text>
                  <Text style={styles.histRowVal}>{batch.items?.length || 0} 种</Text>
                </View>
                <View style={styles.histRow}>
                  <Text style={styles.histRowLabel}>支出分类</Text>
                  <Text style={styles.histRowVal}>{batch.category}</Text>
                </View>
                {batch.note ? (
                  <View style={styles.histRow}>
                    <Text style={styles.histRowLabel}>备注</Text>
                    <Text style={styles.histRowVal}>{batch.note}</Text>
                  </View>
                ) : null}
                <View style={styles.histPayBadge}>
                  <Text style={styles.histPayText}>{batch.payment_method}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: c.textSub }}>本次货款</Text>
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
          ListEmptyComponent={<Text style={styles.emptyText}>暂无进货记录</Text>}
          ListFooterComponent={loadingHist ? <View style={styles.loadingWrap}><ActivityIndicator color={c.primary} /></View> : null}
        />
      )}

      {/* ── Order Drawer ── */}
      {showDrawer && (
        <>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDrawer(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHandle} />
            <View style={styles.drawerHead}>
              <Text style={styles.drawerHeadTitle}>确认进货单</Text>
              <TouchableOpacity style={styles.drawerClose} onPress={() => setShowDrawer(false)}>
                <Text style={styles.drawerCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.drawerBody}>
              {/* Date + Category */}
              <View style={styles.fieldGrid}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>进货日期</Text>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={e => setOrderDate((e.target as HTMLInputElement).value)}
                    style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box' } as any}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>支出分类</Text>
                  <input type="text" value="采购" readOnly style={{ ...styles.fieldInput, width: '100%', boxSizing: 'border-box', opacity: 0.6 } as any} />
                </View>
              </View>

              {/* Payment */}
              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>支付方式</Text>
                <View style={styles.payChips}>
                  {(['现金', '微信', '支付宝'] as PayMethod[]).map(pm => (
                    <TouchableOpacity key={pm} style={[styles.payChip, payMethod === pm && styles.payChipOn]} onPress={() => setPayMethod(pm)}>
                      <Text style={[styles.payChipText, payMethod === pm && styles.payChipTextOn]}>{PAY_ICONS[pm]} {pm}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Upload */}
              <View style={[styles.field, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>上传票据</Text>
                <label style={styles.uploadArea as any}>
                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  <Text style={styles.uploadIcon}>📎</Text>
                  <Text style={styles.uploadText}>点击<Text style={styles.uploadTextAccent}>上传票据</Text>（支持多张）</Text>
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

              {/* Items */}
              <Text style={styles.drawerItemsTitle}>进货明细</Text>
              {cartItems.map(item => (
                <View key={item.product.id} style={styles.drawerItemRow}>
                  <Text style={styles.drawerItemName}>{item.product.name}</Text>
                  <Text style={styles.drawerItemQty}>×{item.quantity}</Text>
                  <Text style={styles.drawerItemAmount}>¥{item.subtotal.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.drawerTotalRow}>
                <Text style={styles.drawerTotalLabel}>本次合计</Text>
                <Text style={styles.drawerTotal}>¥{cartTotal.toFixed(2)}</Text>
              </View>

              {/* Note */}
              <View style={[styles.field, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>备注</Text>
                <TextInput style={styles.fieldInput} value={orderNote} onChangeText={setOrderNote} placeholder="可选备注" placeholderTextColor={c.textSub} />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, cartCount === 0 && styles.submitBtnDisabled]}
                onPress={submitOrder}
                disabled={cartCount === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>提交进货单</Text>
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
            <Text style={styles.successTitle}>进货单已提交</Text>
            <Text style={styles.successSub}>本次进货记录已保存</Text>
            <Text style={styles.successAmount}>¥{successTotal.toFixed(2)}</Text>
            <Text style={{ fontSize: 12, color: c.textSub }}>第{successBatch}次进货 · {orderDate} · {payMethod}</Text>
            <View style={styles.successBtns}>
              <TouchableOpacity style={styles.successBtnNew} onPress={resetOrder}>
                <Text style={styles.successBtnNewText}>继续进货</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.successBtnView} onPress={() => { setShowSuccess(false); setSubTab('history'); }}>
                <Text style={styles.successBtnViewText}>查看记录</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
