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

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf#view=FitH`;

  return (
    <View style={styles.container}>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#141416' }}>
          {/* Navbar */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            height: 56, display: 'flex', alignItems: 'center',
            padding: '0 16px',
            background: 'rgba(20,20,22,.85)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderBottom: '1px solid rgba(255,255,255,.07)',
          }}>
            <button
              onClick={onBack}
              style={{
                width: 36, height: 36, borderRadius: 18,
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#F0EDE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#F0EDE8' }}>
              {title}
            </div>
            <div style={{ width: 36, flexShrink: 0 }} />
          </div>

          {/* PDF iframe — browser native viewer */}
          <iframe
            src={pdfUrl}
            style={{
              position: 'fixed', top: 56, left: 0,
              width: '100%', height: 'calc(100% - 56px)',
              border: 'none', background: '#525659',
            }}
            title="PDF Preview"
          />
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
