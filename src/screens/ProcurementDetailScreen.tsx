import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { trCategory, trPayment } from '../i18nHelpers';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import ImagePreview from '../components/ImagePreview';
import { formatDate } from '../utils/format';
import BackArrow from '../components/icons/BackArrow';
import TrashIcon from '../components/icons/TrashIcon';
import { getCurrentUser } from '../utils/storage';

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
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);

  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (downloading) {
      setTimerSec(0);
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [downloading]);

  if (!batch) {
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

  const downloadPDF = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Jump to the dedicated PDF preview page (hash route handled by
      // App.tsx). The preview page itself fetches the share-link token
      // and embeds the PDF in an iframe. From there the user can
      // download, share via Web Share API, or copy a public 24h link.
      //
      // Why a separate page rather than the in-place download/share
      // pattern we had before: that pattern broke in two ways —
      //   1) desktop Chrome's "always download PDFs" config meant
      //      download would trigger immediately with no chance to preview
      //   2) iOS Safari's short blob URL lifetime + share sheet meant
      //      the share target (WeChat) got a dead blob: link instead
      //      of a real PDF attachment.
      // A preview page decouples "see the PDF" from "share/save it"
      // and gives us one consistent UX across browsers.
      // Prefer the onPreview callback (HomeScreen) for in-app nav.
      // It uses history.replaceState to update the URL silently
      // (no popstate, no hashchange) and pushes 'pdf' to the
      // pageStack directly — bypassing App.tsx's hashchange flow
      // entirely. The previous location.hash path broke on iOS
      // Safari because the popstate from hash assignment fires
      // AFTER any reasonable safety window, popping the page back
      // off the stack. Fall back to the hash path for any future
      // caller that doesn't pass onPreview (e.g. a direct embed).
      if (onPreview) {
        onPreview(batch.id, batch.batch_number);
      } else {
        window.location.hash = `#/preview-pdf?id=${batch.id}&number=${batch.batch_number}`;
      }
    } catch {
      // Fallback: open the login-required PDF endpoint in a new tab
      window.open(`/api/procurement-batches/${batch.id}/pdf`, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!batch || deleting) return;
    setDeleting(true);
    try {
      await api.deleteProcurementBatch(batch.id);
      onBack();
    } catch (err) {
      console.error('[procurement] delete error:', err);
      setDeleting(false);
    }
  };

  const openPreview = (idx: number) => {
    setPreviewData({ images: images.length ? images : thumbImgs, idx });
  };



  const thumbImgs: string[] = (batch.thumb_images?.length ? batch.thumb_images : batch.images) || [];
  const images: string[] = batch.images || [];
  const items = batch.items || [];

  // Map DB payment_method values ('现金','微信','支付宝') to i18n keys
  const PAY_MAP: Record<string, string> = { '现金': 'payCash', '微信': 'payWechat', '支付宝': 'payAlipay' };
  const paymentLabel = trPayment(batch.payment_method);

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
              {t('procNowBatch').replace('{n}', String(batch.batch_number))}
            </Text>
            <Text style={styles.batchDate}>{formatDate(batch.date)}</Text>
          </View>
          <View style={styles.batchActions}>
            <TouchableOpacity onPress={downloadPDF} activeOpacity={0.6} style={styles.actionBtn} disabled={downloading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ViewIcon color={c.primary} />
            </TouchableOpacity>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <EditIcon color={c.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.6} style={styles.actionBtn} disabled={deleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            <Text style={styles.infoValue}>{trCategory(batch.category)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('procOperator')}</Text>
            <Text style={styles.infoValue}>{getCurrentUser() || '—'}</Text>
          </View>
          {batch.note ? (
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingTop: 0 }]}>
              <Text style={styles.infoLabel}>{t('procNoteLabel')}</Text>
              <Text style={styles.infoValue}>{batch.note}</Text>
            </View>
          ) : null}
        </View>

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
              <Text style={styles.totalAmt}>¥{batch.total.toFixed(2)}</Text>
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

      {/* Full-screen loading mask (PDF generation) */}
      {downloading && createPortal(
        <View style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', opacity: 0.8 }}>
          <View style={[styles.loadingCard, { opacity: 1 }]}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={styles.loadingTitle}>{t('procGeneratingPDF')}</Text>
            <Text style={styles.loadingTimer}>{timerSec}<Text style={{ fontSize: FONTS.body.size, fontWeight: '400' }}> s</Text></Text>
          </View>
        </View>,
        document.body
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title={t('procDeleteBatch')}
        message={<>{t('procDeleteBatchConfirmV2').split('{batch}')[0]}<Text style={{ color: c.primary, fontWeight: '600' }}>{t('procNowBatch').replace('{n}', String(batch.batch_number))}</Text>{t('procDeleteBatchConfirmV2').split('{batch}')[1]}</>}
        confirmLabel={t('delete')}
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
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
      gap: 8,
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
    // Full-screen loading card (PDF generation)
    loadingCard: {
      backgroundColor: c.surface,
      paddingVertical: 24,
      paddingHorizontal: 36,
      borderRadius: 16,
      alignItems: 'center',
      minWidth: 200,
    },
    loadingTitle: {
      fontSize: FONTS.body.size,
      fontWeight: '600' as const,
      color: c.textMain,
      marginTop: 14,
    },
    loadingTimer: {
      fontSize: FONTS.h1.size,
      fontWeight: '700' as const,
      color: c.primary,
      marginTop: 6,
      fontVariant: ['tabular-nums'] as any,
    },
    // Preview — matches ExpenseHistoryScreen exactly

  });
};
