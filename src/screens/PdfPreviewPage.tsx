import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const HEADER_H = 56;
const HEADER_TOP = 44;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf#view=FitH`;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.5}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* PDF iframe — absolute fill below header */}
      <iframe
        src={pdfUrl}
        style={{
          position: 'absolute',
          top: HEADER_TOP + HEADER_H,
          left: 0,
          right: 0,
          bottom: 0,
          border: 'none',
          background: '#525659',
        }}
        title="PDF Preview"
      />
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141416',
  },
  header: {
    height: HEADER_H,
    marginTop: HEADER_TOP,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#2C2626',
    lineHeight: 22,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C2626',
  },
  headerRight: {
    width: 44,
  },
});
