import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
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

function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M12 15V3" />
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

export default function ProcurementDetailScreen({ batch, onBack, onEdit }: { batch: BatchRecord | null; onBack: () => void; onEdit?: () => void }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
  const [previewOpacity, setPreviewOpacity] = useState(1);
  const touchStartX = useRef(0);
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={styles.backBtn}>
              <BackArrow color={c.textMain} />
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>{t('procOrderItems')}</Text>
          <View style={{ width: 44 }} />
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
      const resp = await fetch(`/api/procurement-batches/${batch.id}/pdf`);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      // iOS Safari 13+ has a short blob URL lifetime: the moment the
      // download finishes, the blob: URL is invalid, so sharing the
      // page state to WeChat hands WeChat a dead link. Instead, use
      // the Web Share API (iOS 14+ / Android Chrome 75+) to hand the
      // raw PDF bytes to the share sheet — WeChat receives a real
      // PDF attachment, not a link. Fallback to opening the server
      // URL on browsers without navigator.canShare({files}).
      const file = new File([blob], `procurement_${batch.id}.pdf`, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `procurement_${batch.id}` });
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2000);
      } else {
        // Fallback for desktop / older iOS: open the real server URL
        // in a new tab. Cookie-authenticated, so Safari fetches the
        // PDF and either downloads it or displays it inline.
        window.open(`/api/procurement-batches/${batch.id}/pdf`, '_blank');
      }
    } catch {
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
    setPreviewOpacity(1);
  };

  const navPreview = (newIdx: number) => {
    setPreviewOpacity(0);
    setTimeout(() => {
      setPreviewData(prev => prev ? { ...prev, idx: newIdx } : null);
      setPreviewOpacity(1);
    }, 150);
  };

  const thumbImgs: string[] = (batch.thumb_images?.length ? batch.thumb_images : batch.images) || [];
  const images: string[] = batch.images || [];
  const items = batch.items || [];

  // Map DB payment_method values ('现金','微信','支付宝') to i18n keys
  const PAY_MAP: Record<string, string> = { '现金': 'payCash', '微信': 'payWechat', '支付宝': 'payAlipay' };
  const paymentLabel = t(PAY_MAP[batch.payment_method] || batch.payment_method);

  return (
    <View style={styles.container}>
      {/* Header — absolute, glass */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <BackArrow color={c.textMain} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{t('procDetail')}</Text>
        <View style={{ width: 44 }} />
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
            <TouchableOpacity onPress={downloadPDF} activeOpacity={0.6} style={styles.actionBtn} disabled={downloading}>
              <DownloadIcon color={c.primary} />
            </TouchableOpacity>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.actionBtn}>
                <EditIcon color={c.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.6} style={styles.actionBtn} disabled={deleting}>
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
            <Text style={styles.infoValue}>{batch.category}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0, paddingTop: 0 }]}>
            <Text style={styles.infoLabel}>{t('procOperator')}</Text>
            <Text style={styles.infoValue}>{getCurrentUser() || '—'}</Text>
          </View>
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
      {downloading && (
        <View style={styles.loadingMask}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={c.primary} />
            <Text style={styles.loadingTitle}>{t('procGeneratingPDF')}</Text>
            <Text style={styles.loadingTimer}>{timerSec}s</Text>
          </View>
        </View>
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

      {/* Fullscreen image preview — swipe left/right, arrows, counter (matches ExpenseHistoryScreen) */}
      {previewData && (
        <View style={styles.previewOverlay}
          onTouchStart={(e: any) => { touchStartX.current = e.nativeEvent.pageX || e.nativeEvent.touches?.[0]?.pageX || 0; }}
          onTouchEnd={(e: any) => {
            const endX = e.nativeEvent.pageX || e.nativeEvent.changedTouches?.[0]?.pageX || 0;
            const dx = endX - touchStartX.current;
            if (Math.abs(dx) > 60) {
              if (dx < 0 && previewData.idx < previewData.images.length - 1) {
                navPreview(previewData.idx + 1);
              } else if (dx > 0 && previewData.idx > 0) {
                navPreview(previewData.idx - 1);
              }
            }
          }}>
          <TouchableOpacity style={styles.previewClose}
            onPress={() => setPreviewData(null)}
            activeOpacity={0.7}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.surface} strokeWidth={2} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
          {previewData.images.length > 1 && previewData.idx > 0 && (
            <TouchableOpacity style={styles.previewArrowLeft}
              onPress={() => navPreview(previewData.idx - 1)}
              activeOpacity={0.7}>
              <Text style={styles.previewArrowText}>{'\u2039'}</Text>
            </TouchableOpacity>
          )}
          {previewData.images.length > 1 && previewData.idx < previewData.images.length - 1 && (
            <TouchableOpacity style={styles.previewArrowRight}
              onPress={() => navPreview(previewData.idx + 1)}
              activeOpacity={0.7}>
              <Text style={styles.previewArrowText}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
          {React.createElement('img', {
            src: previewData.images[previewData.idx],
            key: previewData.idx,
            decoding: 'async' as any,
            style: {
              maxWidth: '90%', maxHeight: '80%', borderRadius: 12, objectFit: 'contain',
              opacity: previewOpacity,
              // @ts-ignore
              transition: 'opacity 0.2s ease',
            },
            alt: 'preview',
          })}
          {previewData.images.length > 1 && (
            <Text style={styles.previewCounter}>{previewData.idx + 1} / {previewData.images.length}</Text>
          )}
        </View>
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
    // Full-screen loading mask (PDF generation)
    loadingMask: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 998,
    },
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
    previewOverlay: {
      position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
      backgroundColor: 'rgba(0,0,0,0.85)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    previewClose: {
      position: 'absolute' as const, top: 48, right: 20, zIndex: 10,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    previewArrowLeft: {
      position: 'absolute' as const, left: 16, top: '50%' as any, zIndex: 10,
      width: 40, height: 40, borderRadius: 20, marginTop: -20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    previewArrowRight: {
      position: 'absolute' as const, right: 16, top: '50%' as any, zIndex: 10,
      width: 40, height: 40, borderRadius: 20, marginTop: -20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    previewArrowText: { fontSize: FONTS.amount.size, fontWeight: '300' as const, color: c.surface, marginTop: -2 },
    previewCounter: {
      position: 'absolute' as const, bottom: 60, zIndex: 10,
      fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: 'rgba(255,255,255,0.7)',
    },
  });
};
