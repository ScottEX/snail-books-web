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

  const doDownload = () => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
                background: '#26262C', border: '1px solid rgba(255,255,255,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#F0EDE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ marginLeft: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#F0EDE8', letterSpacing: '.01em' }}>{title}</div>
              <div style={{ fontSize: 10, color: 'rgba(240,237,232,.28)', fontFamily: 'DM Mono,monospace', marginTop: 1 }}>
                NO.2026-{String(batchNumber).padStart(4, '0')}
              </div>
            </div>
          </div>

          {/* PDF iframe */}
          <iframe
            src={pdfUrl}
            style={{
              position: 'fixed', top: 56, left: 0,
              width: '100%', height: 'calc(100% - 56px - 72px)',
              border: 'none', background: '#525659',
            }}
            title="PDF Preview"
          />

          {/* Bottom toolbar */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            height: 72,
            background: 'rgba(20,20,22,.88)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderTop: '1px solid rgba(255,255,255,.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            padding: '0 8px 8px',
          }}>
            <button
              onClick={doDownload}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                border: 'none', background: 'none', flex: 1, maxWidth: 90,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(240,237,232,.5)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ fontSize: 10, color: 'rgba(240,237,232,.28)', fontFamily: 'Noto Sans SC,sans-serif' }}>下载</span>
            </button>
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.07)', flexShrink: 0 }} />
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                border: 'none', background: 'none', flex: 1, maxWidth: 90,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(240,237,232,.5)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              <span style={{ fontSize: 10, color: 'rgba(240,237,232,.28)', fontFamily: 'Noto Sans SC,sans-serif' }}>复制链接</span>
            </button>
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.07)', flexShrink: 0 }} />
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                border: 'none', background: 'none', flex: 1, maxWidth: 90,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#C0392B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span style={{ fontSize: 10, color: '#C0392B', fontFamily: 'Noto Sans SC,sans-serif' }}>打印</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
