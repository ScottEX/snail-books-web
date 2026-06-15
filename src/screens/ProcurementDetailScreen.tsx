import { createPortal } from 'react-dom';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Image, Switch,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { trCategory, trPayment } from '../i18nHelpers';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors, MODAL_BACKDROP_OPACITY } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import ImagePreview from '../components/ImagePreview';
import { formatDate } from '../utils/format';
import BackArrow from '../components/icons/BackArrow';
import TrashIcon from '../components/icons/TrashIcon';
import { getCurrentUser } from '../utils/storage';
import { useEffect, useMemo, useRef, useState } from 'react';

interface BatchItem {
  name?: string;
  product_name?: string;
  product_id?: number;
  quantity: number;
  subtotal?: number;
  unit_price?: number;
}

interface BatchRecord {
  id: number;
  batch_number: number;
  date: string;
  payment_method: string;
  category: string;
  total: number;
  note?: string;
  images?: string[];
  thumb_images?: string[];
  items: BatchItem[];
  settled_at?: string | null;
  settled_by?: number | null;
  settled_by_username?: string | null;
}

function ViewIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M8 13h4" />
      <Path d="M8 17h8" />
      <Path d="M8 9h1" />
    </Svg>
  );
}

function EditIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

export default function ProcurementDetailScreen({ batch, onBack, onEdit, onPreview }: { batch: BatchRecord | null; onBack: () => void; onEdit?: () => void; onPreview?: (id: number, number: number) => void }) {
  const { colors: c, theme } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const styles = useMemo(() => getStyles(c), [c]);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
  // Local copy of the batch — lets us update settled_at / settled_by_username in place
  // after the user flips the Switch, without waiting for the parent to re-pass the prop.
  const [cur, setCur] = useState<BatchRecord | null>(batch);
  useEffect(() => { setCur(batch); }, [batch]);
  const [settling, setSettling] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settleError, setSettleError] = useState('');

  if (!cur) {
    return (
      <View style={styles.container} {...swipeBack}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={styles.backBtn}>
              <BackArrow color={c.textMain} />
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>{t('procOrderItems')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textSub }}>—</Text>
        </View>
      </View>
    );
  }

  const downloadPDF = () => {
    // Jump to the dedicated PDF preview page. The preview page handles
    // PDF generation and provides download/share/save UX.
    if (onPreview) {
      onPreview(cur.id, cur.batch_number);
    } else {
      window.location.hash = `#/preview-pdf?id=${cur.id}&number=${cur.batch_number}`;
    }
  };

  const handleDelete = async () => {
    if (!cur || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteProcurementBatch(cur.id);
      setShowDeleteConfirm(false);
      setDeleting(false);
      onBack();
    } catch (err: any) {
      setDeleteError(err?.message || '删除失败，请重试');
      setDeleting(false);
    }
  };

  // Settle — one-way, irreversible. Updates `cur` in place so the audit section
  // and Switch flip immediately. The parent's list still shows the old state until
  // the user navigates back and re-enters (acceptable; rare one-time action).
  const handleSettle = async () => {
    if (!cur || settling) return;
    setSettling(true);
    setSettleError('');
    try {
      const r: any = await api.settleProcurementBatch(cur.id);
      if (r?.status === 'ok' && r.batch) {
        setCur({ ...cur, ...r.batch });
        setShowSettleConfirm(false);
      } else {
        setSettleError(r?.message || t('toastSubmitFailed'));
      }
    } catch (err: any) {
      setSettleError(err?.message || t('toastSubmitFailed'));
    } finally {
      setSettling(false);
    }
  };

  const openPreview = (idx: number) => {
    setPreviewData({ images: images.length ? images : thumbImgs, idx });
  };



  const thumbImgs: string[] = (cur.thumb_images?.length ? cur.thumb_images : cur.images) || [];
  const images: string[] = cur.images || [];
  const items = cur.items || [];

  // Map DB payment_method values ('现金','微信','支付宝') to i18n keys
  const PAY_MAP: Record<string, string> = { '现金': 'payCash', '微信': 'payWechat', '支付宝': 'payAlipay' };
  const paymentLabel = trPayment(cur.payment_method);

  return (
    <View style={styles.container} {...swipeBack}>
      {/* Header — absolute, glass */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <BackArrow color={c.textMain} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{t('procDetail')}</Text>
      </View>

      {/* Body — scrolls under header */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Batch info — with action buttons on the right */}
        <View style={styles.batchInfoRow}>
          <View>
            <Text style={styles.batchLabel}>
              {t('procNowBatch').replace('{n}', String(cur.batch_number))}
            </Text>
            <Text style={styles.batchDate}>{formatDate(cur.date)}</Text>
          </View>
          <View style={styles.batchActions}>
            {/* Settle switch — one-way, irreversible. To the LEFT of the PDF view button.
                Natural size (≈52×31); row alignItems: center keeps it vertically aligned
                with the other 36×36 action buttons. */}
            <Switch
              value={!!cur.settled_at}
              onValueChange={(v) => {
                // Only react to flip-ON; flipping OFF is ignored (irreversible).
                if (v && !cur.settled_at) setShowSettleConfirm(true);
              }}
              disabled={settling}
              trackColor={{ false: withAlpha(c.textMain, 0.18), true: '#3DBC75' }}
              thumbColor="#fff"
            />
            <TouchableOpacity onPress={downloadPDF} activeOpacity={0.6} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ViewIcon color={c.primary} />
            </TouchableOpacity>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <EditIcon color={c.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.6}
              style={[styles.actionBtn, !!cur.settled_at && { opacity: 0.3 }]}
              disabled={deleting || !!cur.settled_at}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <TrashIcon color={c.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('procPaymentMethod')}</Text>
            <Text style={styles.infoValue}>{paymentLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('expenseCategory')}</Text>
            <Text style={styles.infoValue}>{trCategory(cur.category)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('procOperator')}</Text>
            <Text style={styles.infoValue}>{getCurrentUser() || '—'}</Text>
          </View>
          {cur.note ? (
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingTop: 0 }]}>
              <Text style={styles.infoLabel}>{t('procNoteLabel')}</Text>
              <Text style={styles.infoValue}>{cur.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Settlement info — only shown if this batch has been settled */}
        {cur.settled_at ? (
          <View style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { marginBottom: 8, color: c.success }]}>
              {t('procSettleInfo')}
            </Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('procSettleAt')}</Text>
              <Text style={styles.infoValue}>{cur.settled_at}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>{t('procSettleBy')}</Text>
              <Text style={styles.infoValue}>{cur.settled_by_username || '—'}</Text>
            </View>
          </View>
        ) : null}

        {/* Images */}
        {thumbImgs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('procImages')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {thumbImgs.map((img: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => openPreview(i)} activeOpacity={0.8}>
                  <Image
                    source={{ uri: img }}
                    style={styles.thumb}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{t('procOrderItems')}</Text>
            <View style={styles.totalWrap}>
              <Text style={styles.totalLabel}>{t('procTotal')}</Text>
              <Text style={styles.totalAmt}>¥{cur.total.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.itemsCard}>
            {items.map((item, idx) => {
              const name = item.name || item.product_name || `${t('procProduct')}#${item.product_id}`;
              const subtotal = item.subtotal ?? (item.unit_price ?? 0) * item.quantity;
              return (
                <View key={idx} style={[styles.itemRow, idx < items.length - 1 && styles.itemRowBorder]}>
                  <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                  <Text style={styles.itemAmt}>¥{(subtotal || 0).toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete confirmation modal */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title={t('procDeleteBatch')}
        message={deleteError ? (
          <Text style={{ color: c.danger, fontSize: FONTS.micro.size, textAlign: 'center' }}>{deleteError}</Text>
        ) : (
          <>{t('procDeleteBatchConfirmV2').split('{batch}')[0]}<Text style={{ color: c.primary, fontWeight: '600' }}>{t('procNowBatch').replace('{n}', String(cur.batch_number))}</Text>{t('procDeleteBatchConfirmV2').split('{batch}')[1]}</>
        )}
        confirmLabel={deleting ? '删除中…' : t('delete')}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
      />

      {/* Settle confirmation modal — one-way, irreversible */}
      <ConfirmModal
        visible={showSettleConfirm}
        title={t('procSettleTitle')}
        message={settleError ? (
          <Text style={{ color: c.danger, fontSize: FONTS.micro.size, textAlign: 'center' }}>{settleError}</Text>
        ) : (
          <Text>{t('procSettleMsg')}</Text>
        )}
        confirmLabel={settling ? '清账中…' : t('procSettle')}
        loading={settling}
        onConfirm={handleSettle}
        onCancel={() => { setShowSettleConfirm(false); setSettleError(''); }}
      />

      {previewData && (
        <ImagePreview
          images={previewData.images}
          initialIdx={previewData.idx}
          visible={true}
          onClose={() => setPreviewData(null)}
        />
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: {
      flex: 1,
      // No background — let HomeScreen bgLayer show through header area
    },
    ...hdr,
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: withAlpha(c.bg, 0.30),
      justifyContent: 'center' as const, alignItems: 'center' as const,
      // @ts-ignore
      backdropFilter: 'saturate(200%) blur(30px)',
      borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
    },
    batchInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    batchActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginTop: 2,
    },
    batchLabel: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: c.textMain,
    },
    batchDate: {
      fontSize: FONTS.micro.size,
      color: c.textSub,
      marginTop: 2,
    },
    body: {
      flex: 1,
      marginTop: 100, // space for glass header + clearance
      backgroundColor: c.bg, // bg moved from container so header area stays transparent
    },
    bodyContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    // Info card
    infoCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      minHeight: 42,
      borderBottomWidth: 0.5,
      borderBottomColor: withAlpha(c.textMain, 0.06),
    },
    infoLabel: {
      fontSize: FONTS.sub.size,
      color: c.textSub,
    },
    infoValue: {
      fontSize: FONTS.sub.size,
      fontWeight: '500' as const,
      color: c.textMain,
    },
    // Section
    section: {
      marginBottom: 16,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: FONTS.micro.size,
      fontWeight: '600',
      color: c.textSub,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    totalLabel: {
      fontSize: FONTS.micro.size,
      color: c.textSub,
      marginRight: 6,
    },
    totalWrap: {
      flexDirection: 'row', alignItems: 'baseline',
      marginRight: 16, // compensate itemsCard paddingHorizontal
    },
    totalAmt: {
      fontSize: FONTS.body.size,
      fontWeight: '700' as const,
      color: c.primary,
      minWidth: 72,
      textAlign: 'right' as const,
    },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 0.5,
      borderColor: withAlpha(c.textMain, 0.08),
    },
    // Items card
    itemsCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    itemRowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: withAlpha(c.textMain, 0.06),
    },
    itemName: {
      flex: 1,
      fontSize: FONTS.sub.size,
      color: c.textMain,
    },
    itemQty: {
      fontSize: FONTS.sub.size,
      color: c.textSub,
      marginRight: 16,
    },
    itemAmt: {
      fontSize: FONTS.sub.size,
      fontWeight: '600' as const,
      color: c.textMain,
      minWidth: 72,
      textAlign: 'right' as const,
    },
  });
};