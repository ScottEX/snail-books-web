import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';

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
  total: number;
  note?: string;
  images?: string[];
  thumb_images?: string[];
  items: BatchItem[];
}

function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

function DocIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M8 13h2" />
      <Path d="M8 17h6" />
      <Path d="M14 13h2" />
    </Svg>
  );
}

export default function ProcurementDetailScreen({ batch, onBack }: { batch: BatchRecord | null; onBack: () => void }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);
  const [previewOpacity, setPreviewOpacity] = useState(1);
  const touchStartX = useRef(0);

  if (!batch) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
            <BackArrow color={c.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('procOrderItems')}</Text>
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `procurement_${batch.id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      window.open(`/api/procurement-batches/${batch.id}/pdf`, '_blank');
    } finally {
      setDownloading(false);
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

  // Note is auto-generated from procNowBatch, not user-entered — rebuild with i18n
  const noteLabel = t('procNowBatch').replace('{n}', String(batch.batch_number));

  // Date formatting matching ExpenseHistoryScreen fmtExpDate
  const formatDateLocale = (d: string) => {
    const [y, m, day] = d.split('-');
    const l = getLang();
    if (l.startsWith('en')) { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[+m-1]} ${+day}, ${y}`; }
    return `${y}年${+m}月${+day}日`;
  };

  return (
    <View style={styles.container}>
      {/* Header — absolute, glass */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <BackArrow color={c.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('procDetail')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Body — scrolls under header */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Batch info — moved out of header */}
        <View style={styles.batchInfo}>
          <Text style={styles.batchLabel}>
            {t('procNowBatch').replace('{n}', String(batch.batch_number))}
          </Text>
          <Text style={styles.batchDate}>{formatDateLocale(batch.date)}</Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('procPaymentMethod')}</Text>
            <Text style={styles.infoValue}>{paymentLabel}</Text>
          </View>
          {batch.note ? (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>{t('procNoteOptional')}</Text>
              <Text style={styles.infoValue}>{noteLabel}</Text>
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
          <Text style={styles.sectionTitle}>{t('procOrderItems')}</Text>
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

        {/* Total + Download */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('procTotal')}</Text>
          <Text style={styles.totalAmt}>¥{batch.total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.downloadBtn, downloading && { opacity: 0.7 }]}
          onPress={downloadPDF}
          disabled={downloading}
          activeOpacity={0.7}
        >
          <DocIcon color={c.surface} />
          <Text style={styles.downloadText}>
            {downloading ? `⏳ ${t('procGenerating')}` : downloaded ? `✅ ${t('procSaved')}` : `📥 ${t('procDownloadPDF')}`}
          </Text>
        </TouchableOpacity>

        {downloading && (
          <View style={styles.downloadOverlay}>
            <View style={styles.downloadOverlayCard}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={styles.downloadOverlayText}>{t('procGeneratingPDF')}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

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
      backgroundColor: c.bg,
    },
    ...hdr,
    headerTitle: {
      fontSize: FONTS.body.size,
      fontWeight: '400' as const,
      color: c.textMain,
    },
    batchInfo: {
      marginBottom: 16,
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
      paddingVertical: 8,
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
    sectionTitle: {
      fontSize: FONTS.micro.size,
      fontWeight: '600',
      color: c.textSub,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    // Thumbnails
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
    // Total
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 12,
      marginBottom: 16,
    },
    totalLabel: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: c.textMain,
    },
    totalAmt: {
      fontSize: FONTS.h2.size,
      fontWeight: '700' as const,
      color: c.primary,
    },
    // Download
    downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: c.primary,
      marginBottom: 8,
    },
    downloadText: {
      fontSize: FONTS.body.size,
      fontWeight: '600',
      color: c.surface,
    },
    downloadOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      borderRadius: 12,
    },
    downloadOverlayCard: {
      backgroundColor: c.surface,
      paddingVertical: 16,
      paddingHorizontal: 28,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    downloadOverlayText: {
      fontSize: FONTS.micro.size,
      color: c.textSub,
      marginTop: 10,
    },
    // Preview
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
