import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, ThemeColors, withAlpha } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import ModalOverlay from './ModalOverlay';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  confirmColor?: string;
  cancelLabel?: string;
  headerColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Standardized confirmation modal with spring animation, used for all delete/confirm dialogs. */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  confirmColor,
  cancelLabel,
  headerColor,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors: c } = useTheme();
  const styles = getStyles(c);
  const hdr = headerColor || c.primary;
  const btn = confirmColor || c.primary;

  return (
    <ModalOverlay visible={visible} onClose={onCancel}>
      <View style={styles.card}>
        <View style={[styles.header, { backgroundColor: hdr }]}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{message}</Text>
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.cancelBtn, loading && styles.btnDisabled]} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>{cancelLabel || t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: btn }, loading && styles.btnDisabled]} onPress={onConfirm} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={c.surface} />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel || t('delete')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ModalOverlay>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface, borderRadius: 16,
    width: 340, maxWidth: '100%', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.surface },
  closeBtn: { fontSize: 18, color: c.surface, fontWeight: '300' },
  body: { padding: 24, gap: 18 },
  warningBox: {
    backgroundColor: withAlpha(c.primary, 0.1), borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  warningText: { fontSize: FONTS.micro.size, color: c.textSub, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 8, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    backgroundColor: withAlpha(c.textMain, 0.06), alignItems: 'center',
  },
  cancelText: { fontSize: FONTS.sub.size, fontWeight: '600', color: c.textMain },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  confirmText: { fontSize: FONTS.sub.size, fontWeight: '600', color: c.surface },
  btnDisabled: { opacity: 0.5 },
});
