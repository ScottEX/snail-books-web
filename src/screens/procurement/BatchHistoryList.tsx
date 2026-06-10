import React, { useMemo } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from "../../i18n";
import EmptyState from "../../components/EmptyState";
import { trPayment } from '../../i18nHelpers';
import { useTheme, withAlpha, ThemeColors } from '../../theme';
import { FONTS } from '../../theme';
import TrashIcon from '../../components/icons/TrashIcon';

// ═══════════════════════════════════════════════
// Local SVG Icon
// ═══════════════════════════════════════════════
function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}
function EmptyClipboardIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface BatchRecord { id: number; batch_number: number; date: string; payment_method: string; category: string; total: number; images: string[]; thumb_images?: string[]; note: string; items: any[]; }

interface Props {
  batches: BatchRecord[];
  loading: boolean;
  total: number;
  onViewDetail: (batch: BatchRecord) => void;
  onEdit: (batch: BatchRecord) => void;
  onDelete: (batch: BatchRecord) => void;
  onLoadMore: () => void;
}

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════
const getStyles = (c: ThemeColors) => StyleSheet.create({
  historyList: { padding: 12, paddingBottom: 100 },
  historyCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.06), marginBottom: 10, overflow: 'hidden' as const },
  histHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 10, borderBottomWidth: 1, borderBottomColor: withAlpha(c.textMain, 0.05) },
  histNo: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: c.primary },
  histDate: { fontSize: FONTS.micro.size, color: c.textSub },
  histActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  histActionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: withAlpha(c.textMain, 0.04) },
  histBody: { padding: 10 },
  histRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  histRowLabel: { fontSize: FONTS.micro.size, color: c.textSub },
  histRowVal: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: c.textMain },
  histAmount: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: c.primary, marginTop: 8 },
  histImages: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, marginTop: 6 },
  // Empty state

  loadingWrap: { paddingVertical: 20, alignItems: 'center' as const },
});

// ═══════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════
export default function BatchHistoryList({ batches, loading, total, onViewDetail, onEdit, onDelete, onLoadMore }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  return (
    <FlatList
      data={batches}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.historyList}
      onEndReached={batches.length < total ? onLoadMore : undefined}
      onEndReachedThreshold={0.4}
      renderItem={({ item: batch }) => (
        <View style={styles.historyCard}>
          <TouchableOpacity onPress={() => onViewDetail(batch)} activeOpacity={0.7} style={{ padding: 12 }}>
            <View style={styles.histHead}>
              <Text style={styles.histNo}>{t('procNowBatch').replace('{n}', String(batch.batch_number))}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.histDate}>{batch.date}</Text>
                <View style={styles.histActions}>
                  <TouchableOpacity
                    style={styles.histActionBtn}
                    onPress={(e) => { e.stopPropagation?.(); onEdit(batch); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <PencilIcon color={c.textSub} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.histActionBtn}
                    onPress={(e) => { e.stopPropagation?.(); onDelete(batch); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <TrashIcon color={c.danger} size={14} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.histBody}>
              <View style={styles.histRow}>
                <Text style={styles.histRowLabel}>{t('procOrderItems')}</Text>
                <Text style={styles.histRowVal}>{batch.items?.length || 0} {t('procUnit')}</Text>
              </View>
              <View style={styles.histRow}>
                <Text style={styles.histRowLabel}>{t('procPaymentMethod')}</Text>
                <Text style={styles.histRowVal}>{trPayment(batch.payment_method)}</Text>
              </View>
              {batch.note ? (
                <View style={styles.histRow}>
                  <Text style={styles.histRowLabel}>{t('procNoteOptional')}</Text>
                  <Text style={styles.histRowVal}>{batch.note}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: FONTS.micro.size, color: c.textSub }}>{t('procThisBatch')}</Text>
                <Text style={styles.histAmount}>¥{batch.total.toFixed(2)}</Text>
              </View>
              {(() => {
                const thumbImgs: string[] = (batch.thumb_images?.length ? batch.thumb_images : batch.images) || [];
                return thumbImgs.length > 0 && (
                  <View style={styles.histImages}>
                    {thumbImgs.map((img: string, i: number) => (
                      <Image key={i} source={{ uri: img }}
                        style={{ width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderColor: withAlpha(c.textMain, 0.08) }} />
                    ))}
                  </View>
                );
              })()}
            </View>
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon={<EmptyClipboardIcon color={c.textSub} />}
          title={t('procEmptyHistoryTitle')}
          hint={t('procEmptyHistoryHint')}
        />
      }
      ListFooterComponent={loading ? <View style={styles.loadingWrap}><ActivityIndicator color={c.primary} /></View> : null}
    />
  );
}
