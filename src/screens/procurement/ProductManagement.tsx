import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Animated, StyleSheet
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from "../../i18n";
import EmptyState from "../../components/EmptyState";
import { api } from '../../api/client';
import { useTheme, withAlpha, ThemeColors } from '../../theme';
import { FONTS } from '../../theme';
import { modalCardAnimation } from '../../sharedStyles';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import TextField from '../../components/TextField';
import ButtonPair from '../../components/ButtonPair';
import CloseButton from '../../components/CloseButton';
import PlusIcon from '../../components/icons/PlusIcon';
import TrashIcon from '../../components/icons/TrashIcon';

// ═══════════════════════════════════════════════
// Local SVG Icons
// ═══════════════════════════════════════════════
function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}
function EmptyBoxIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <Path d="M12 22.08V12" />
    </Svg>
  );
}
function ChevronDownIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface Product { id: number; name: string; spec: string; price: number; supplier: string; note?: string; }

interface Props {
  products: Product[];
  suppliers: string[];
  onRefresh: () => void;
}

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════
const getStyles = (c: ThemeColors) => StyleSheet.create({
  contentArea: { flex: 1, paddingBottom: 100 },
  mgmtRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 12, marginHorizontal: 12, marginBottom: 6, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06) },
  mgmtInfo: { flex: 1 },
  mgmtName: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textMain },
  mgmtMeta: { fontSize: FONTS.micro.size, color: c.textSub, marginTop: 2 },
  mgmtActions: { flexDirection: 'row' as const, gap: 8 },
  mgmtActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: withAlpha(c.textMain, 0.05) },
  mgmtAddBtn: { marginHorizontal: 12, marginTop: 8, marginBottom: 16, flexDirection: 'row' as const, backgroundColor: withAlpha(c.primary, 0.06), borderRadius: 10, paddingVertical: 11, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 },
  mgmtAddBtnText: { fontSize: FONTS.sub.size, fontWeight: FONTS.subBold.weight, color: c.primary },
  // Empty state

  // Modal (product add/edit)
  modalOverlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 400, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center' as const, alignItems: 'center' as const },
  modalCard: { backgroundColor: c.surface, borderRadius: 16, width: 340, maxWidth: '90%' as any, overflow: 'hidden' as const,
    // @ts-ignore
    ...modalCardAnimation },
  modalHeader: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  modalTitle: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.surface },
  modalBody: { padding: 24 },
  // @ts-expect-error web-only outline property
  modalInput: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, fontSize: FONTS.sub.size, color: c.textMain, backgroundColor: withAlpha(c.textMain, 0.03), marginBottom: 10, outline: 'none' },
});

// ═══════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════
export default function ProductManagement({ products, suppliers, onRefresh }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({ name: '', spec: '', price: '', supplier: '', note: '' });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── Slide-from-top animation for modals ──
  const modalSlide = useRef(new Animated.Value(0)).current;
  const modalOverlayFade = useRef(new Animated.Value(0)).current;
  const openSlideModal = (show: () => void) => {
    show();
    modalSlide.setValue(-300);
    modalOverlayFade.setValue(0);
    Animated.parallel([
      Animated.spring(modalSlide, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
      Animated.timing(modalOverlayFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const closeSlideModal = (hide: () => void) => {
    Animated.parallel([
      Animated.timing(modalSlide, { toValue: -300, duration: 180, useNativeDriver: true }),
      Animated.timing(modalOverlayFade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => hide());
  };

  // ── Product CRUD ──
  const openAddProduct = () => {
    setEditingProduct(null);
    setProdForm({ name: '', spec: '', price: '', supplier: '', note: '' });
    openSlideModal(() => setShowProductModal(true));
  };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdForm({ name: p.name, spec: p.spec, price: String(p.price), supplier: p.supplier, note: p.note || '' });
    openSlideModal(() => setShowProductModal(true));
  };
  const saveProduct = async () => {
    if (!prodForm.name) return;
    const data = { name: prodForm.name, spec: prodForm.spec, price: parseFloat(prodForm.price) || 0, supplier: prodForm.supplier, note: prodForm.note };
    try {
      editingProduct ? await api.updateProduct({ ...data, id: editingProduct.id }) : await api.createProduct(data);
      closeSlideModal(() => setShowProductModal(false));
      onRefresh();
    } catch {
      setToastMsg(t('toastSubmitFailed'));
      setShowToast(true);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteProduct(deleteTarget.id);
      onRefresh();
    } catch {
      setToastMsg(t('toastSubmitFailed'));
      setShowToast(true);
    }
    closeSlideModal(() => setDeleteTarget(null));
  };

  return (
    <>
      <ScrollView style={styles.contentArea}>
        <TouchableOpacity style={styles.mgmtAddBtn} onPress={openAddProduct}>
          <PlusIcon color={c.primary} />
          <Text style={styles.mgmtAddBtnText}>{t('procAddProduct')}</Text>
        </TouchableOpacity>
        {products.length === 0 ? (
          <EmptyState
            icon={<EmptyBoxIcon color={c.textSub} />}
            title={t('procEmptyProductsTitle')}
            hint={t('procEmptyProductsHint')}
          />
        ) : (
          [...products].sort((a, b) => b.id - a.id).map(p => (
            <View key={p.id} style={styles.mgmtRow}>
              <View style={styles.mgmtInfo}>
                <Text style={styles.mgmtName}>{p.name}</Text>
                <Text style={styles.mgmtMeta}>{p.supplier} · {p.spec} · ¥{p.price.toFixed(2)}</Text>
              </View>
              <View style={styles.mgmtActions}>
                <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => openEditProduct(p)}>
                  <PencilIcon color={c.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.mgmtActionBtn} onPress={() => openSlideModal(() => setDeleteTarget(p))}>
                  <TrashIcon color={c.danger} size={14} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Product Modal ── */}
      {showProductModal && (
        <Animated.View style={[styles.modalOverlay, { opacity: modalOverlayFade }]}>
          <Animated.View style={[styles.modalCard, { transform: [{ translateY: modalSlide }] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? t('procEditProduct') : t('procAddProduct')}</Text>
              <CloseButton onPress={() => closeSlideModal(() => setShowProductModal(false))} />
            </View>
            <View style={styles.modalBody}>
              <TextField placeholder={t('procProductName')} value={prodForm.name} onChangeText={v => setProdForm(p => ({ ...p, name: v }))} />
              <TextField placeholder={t('procProductSpec')} value={prodForm.spec} onChangeText={v => setProdForm(p => ({ ...p, spec: v }))} />
              <View style={[styles.modalInput, { position: 'relative', justifyContent: 'center' }]}>
                <Text style={{ fontSize: FONTS.sub.size, color: prodForm.supplier ? c.textMain : c.textSub }}>
                  {prodForm.supplier || t('procProductSupplier')}
                </Text>
                <View style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <ChevronDownIcon color={c.textSub} />
                </View>
                {React.createElement('select', {
                  value: prodForm.supplier,
                  onChange: (e: any) => setProdForm(p => ({ ...p, supplier: e.target.value })),
                  style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, cursor: 'pointer' } as any,
                },
                  <option key="__placeholder" value="" disabled>{t('procProductSupplier')}</option>,
                  suppliers.filter((s: string) => s !== '全部').map((s: string) => (
                    React.createElement('option', { key: s, value: s }, s)
                  ))
                )}
              </View>
              <TextField placeholder={t('procProductPrice')} value={prodForm.price} onChangeText={v => setProdForm(p => ({ ...p, price: v }))} keyboardType="numeric" />
              <TextField placeholder={t('procProductNote')} value={prodForm.note} onChangeText={v => setProdForm(p => ({ ...p, note: v }))} />
              <ButtonPair
                leftLabel={t('cancel')}
                leftOnPress={() => closeSlideModal(() => setShowProductModal(false))}
                rightLabel={t('procSubmit')}
                rightOnPress={saveProduct}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Delete confirmation modal ── */}
      <ConfirmModal
        visible={deleteTarget !== null}
        title={t('procDeleteProduct') || '删除商品'}
        message={<>{t('procDeleteProductConfirm').split('{name}')[0]}<Text style={{ color: c.primary, fontWeight: '600' }}>{deleteTarget?.name}</Text>{t('procDeleteProductConfirm').split('{name}')[1]}{' '}{t('procDeleteProductWarning')}</>}
        confirmLabel={t('delete')}
        onConfirm={() => confirmDelete()}
        onCancel={() => closeSlideModal(() => setDeleteTarget(null))}
      />

      <Toast message={toastMsg} visible={showToast} onDismiss={() => setShowToast(false)} />
    </>
  );
}
