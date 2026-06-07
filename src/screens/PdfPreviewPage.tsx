import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const NAV_TOP = 44;
const NAV_H = 56;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf#view=FitH`;

  return (
    <View style={styles.container}>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#141416' }}>
          {/* back button */}
          <div style={{
            position: 'fixed', top: NAV_TOP, left: 0, right: 0, zIndex: 100,
            height: NAV_H, display: 'flex', alignItems: 'center',
            padding: '0 16px', background: 'transparent',
          }}>
            <button
              onClick={onBack}
              style={{
                width: 44, height: 44, borderRadius: 22,
                background: 'rgba(255,255,255,0.30)',
                border: '0.5px solid rgba(0,0,0,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#2C2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 500, color: '#2C2626' }}>
              {title}
            </div>
            <div style={{ width: 44 }} />
          </div>

          {/* PDF iframe */}
          <iframe
            src={pdfUrl}
            style={{
              position: 'fixed',
              top: NAV_TOP + NAV_H,
              left: 0, right: 0, bottom: 0,
              border: 'none',
              background: '#525659',
            }}
            title="PDF Preview"
          />
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
});
