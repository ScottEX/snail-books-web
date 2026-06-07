import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const HEADER_H = 56;
const TOOLBAR_H = 72;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [pdfReady, setPdfReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct PDF URL — backend auth handles access control
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf`;

  const title = t('procPdfTitle').replace('{n}', String(batchNumber));

  const handleIframeLoad = useCallback(() => {
    setPdfReady(true);
  }, []);

  const handleIframeError = useCallback(() => {
    setPdfReady(true);
    setError('PDF 加载失败，请重试');
  }, []);

  // ── Actions ──
  const doDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [batchId, pdfUrl]);

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }, []);

  return (
    <View style={styles.overlay}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={onBack} style={styles.navBack}>
          <BackArrow color="#F0EDE8" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* PDF iframe */}
      <View style={styles.iframeWrap}>
        {error ? (
          <View style={styles.errWrap}>
            <Text style={styles.errText}>{error}</Text>
            <TouchableOpacity onPress={onBack} style={styles.retryBtn}>
              <Text style={styles.retryText}>返回</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <iframe
            src={pdfUrl + '#view=FitH'}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: pdfReady ? 'block' : 'none',
            }}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="PDF Preview"
          />
        )}
        {!pdfReady && !error && (
          <View style={styles.loadingWrap}>
            <View style={styles.spinner} />
            <Text style={styles.loadingText}>加载 PDF…</Text>
          </View>
        )}
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={doDownload}>
          <Text style={styles.toolLabel}>⬇️ 下载</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={copyLink}>
          <Text style={styles.toolLabel}>🔗 复制链接</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => window.print()}>
          <Text style={styles.toolLabel}>🖨️ 打印</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  overlay: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#141416',
  },
  navbar: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 10,
    height: HEADER_H, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, paddingHorizontal: 16,
    backgroundColor: 'rgba(20,20,22,.85)',
  } as any,
  navBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#26262C', borderWidth: 0.5, borderColor: 'rgba(255,255,255,.12)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  navTitle: { fontSize: 15, fontWeight: '600' as const, color: '#F0EDE8' },
  iframeWrap: {
    position: 'absolute' as const, top: HEADER_H, left: 0, right: 0, bottom: TOOLBAR_H,
    backgroundColor: '#525659',
  },
  loadingWrap: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  } as any,
  spinner: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, borderColor: 'rgba(255,255,255,.15)',
    borderTopColor: c.primary,
  } as any,
  loadingText: { marginTop: 12, fontSize: 14, color: 'rgba(240,237,232,.5)' },
  errWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errText: { fontSize: 16, color: '#F0EDE8', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.primary, borderRadius: 10 },
  retryText: { fontSize: 14, color: '#fff' },
  toolbar: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    height: TOOLBAR_H, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-around' as const, paddingHorizontal: 8, paddingBottom: 8,
    backgroundColor: 'rgba(20,20,22,.88)',
  } as any,
  toolBtn: { flex: 1, maxWidth: 90, alignItems: 'center' as const, paddingVertical: 8 },
  toolLabel: { fontSize: 10, color: 'rgba(240,237,232,.28)' },
  toolSep: { width: 0.5, height: 36, backgroundColor: 'rgba(255,255,255,.07)' },
});
