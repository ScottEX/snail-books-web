import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';
import { historyHeader } from '../sharedStyles';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

/* ── Icons ── */
function DownloadSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

function ShareSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <Path d="M16 6l-4-4-4 4" />
      <Line x1="12" y1="2" x2="12" y2="15" />
    </Svg>
  );
}

function LinkSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </Svg>
  );
}

function PrinterSvg({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9V2h12v7" />
      <Path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <Rect x="6" y="14" width="12" height="8" />
    </Svg>
  );
}

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Step 1: Get the share link
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r: any = await api.getProcurementShareLink(batchId);
        if (!cancelled) {
          if (r?.url) {
            setTokenUrl(r.url);
          } else {
            setError(t('pdfLoadFailed'));
            setLoading(false);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || t('pdfLoadFailed'));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  // Step 2: Pre-fetch the PDF to verify it's reachable and valid
  useEffect(() => {
    if (!tokenUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(tokenUrl, { credentials: 'same-origin' });
        if (cancelled) return;

        if (!resp.ok) {
          let msg = `服务器错误 (${resp.status})`;
          try {
            const body = await resp.clone().json();
            if (body?.message) msg = body.message;
          } catch {}
          setError(msg);
          setLoading(false);
          return;
        }

        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('pdf')) {
          setError('服务器返回了非PDF内容');
          setLoading(false);
          return;
        }

        const blob = await resp.blob();
        if (cancelled) return;

        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || '网络错误，无法加载PDF');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tokenUrl]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const publicUrl = tokenUrl
    ? (typeof window !== 'undefined' ? window.location.origin + tokenUrl : tokenUrl)
    : '';

  const doDownload = useCallback(async () => {
    if (!tokenUrl) return;
    showToast('⬇️ PDF 下载中…');
    try {
      const a = document.createElement('a');
      a.href = tokenUrl;
      a.download = `procurement_${batchId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { showToast('下载失败'); }
    setShareSheetOpen(false);
  }, [tokenUrl, batchId, showToast]);

  const copyLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(publicUrl); } catch {}
    showToast('链接已复制');
  }, [publicUrl, showToast]);

  const retry = useCallback(() => {
    setPdfBlobUrl(null);
    setError(null);
    setTokenUrl(null);
    setLoading(true);
  }, []);

  // ── Header component ──
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
        <View style={styles.backBtn}><BackArrow color={c.textMain} /></View>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {t('procPdfTitle').replace('{n}', String(batchNumber))}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.viewer}>
          <View style={styles.centered}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={styles.hintText}>{tokenUrl ? '正在生成 PDF…' : t('pdfLoading')}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.viewer}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retry} style={styles.retryBtn} activeOpacity={0.7}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBack} style={[styles.retryBtn, { marginTop: 8, backgroundColor: c.secondary }]} activeOpacity={0.7}>
              <Text style={[styles.retryText, { color: c.textMain }]}>{t('goBack')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {/* PDF display — uses pre-fetched blob URL, guaranteed valid */}
      <View style={styles.viewer}>
        {pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
            style={styles.iframe as any}
            title={`procurement_${batchId}.pdf`}
          />
        ) : null}
      </View>

      {/* 底部工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={doDownload} activeOpacity={0.7}>
          <DownloadSvg color={c.textSub} />
          <Text style={styles.toolLabel}>{t('downloadPdf')}</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShareSheetOpen(true)} activeOpacity={0.7}>
          <ShareSvg color={c.textSub} />
          <Text style={styles.toolLabel}>{t('share')}</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={copyLink} activeOpacity={0.7}>
          <LinkSvg color={c.textSub} />
          <Text style={styles.toolLabel}>复制链接</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => window.print()} activeOpacity={0.7}>
          <PrinterSvg color={c.primary} />
          <Text style={[styles.toolLabel, { color: c.primary }]}>打印</Text>
        </TouchableOpacity>
      </View>

      {/* 分享面板 */}
      {shareSheetOpen && (
        <View style={styles.sheetOverlay as any}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareSheetOpen(false)} />
          <View style={styles.sheet as any}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>分享进货单</Text>
            <View style={styles.sheetGrid}>
              {[
                ['微信', '#07C160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                ['朋友圈', '#fa9d3b', 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32'],
                ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
                ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6'],
                ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'],
                ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
                ['保存图片', '#2e8b57', 'M3 3h18v18H3zM21 15l-5-5L5 21M8.5 8.5a1.5 1.5 0 100 .01'],
                ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
              ].map(([label, bg, d]) => (
                <TouchableOpacity
                  key={label}
                  style={styles.sheetItem}
                  onPress={() => {
                    setShareSheetOpen(false);
                    if (label === '下载PDF') doDownload();
                    else if (label === '复制链接') copyLink();
                    else if (label === '邮件' && tokenUrl) {
                      window.location.href = `mailto:?subject=procurement_${batchId}.pdf&body=${encodeURIComponent(publicUrl)}`;
                    } else {
                      showToast(`已分享至${label}`);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sheetIcon, { backgroundColor: bg }]}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}>
                      <Path d={d} />
                    </Svg>
                  </View>
                  <Text style={styles.sheetItemLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShareSheetOpen(false)} style={styles.sheetCancel} activeOpacity={0.7}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Toast */}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  const bg = c.bg || '#F9F7F4';
  return StyleSheet.create({
    container: { flex: 1, minHeight: '100vh' } as any,
    ...hdr,
    viewer: {
      flex: 1,
      minHeight: 'calc(100vh - 100px)' as any,
      backgroundColor: bg,
      marginTop: 100,
    } as any,
    iframe: {
      width: '100%',
      height: '100%',
      borderWidth: 0,
      backgroundColor: '#fff',
    } as any,
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 24 },
    hintText: { fontSize: FONTS.body.size, color: c.textSub, marginTop: 12 },
    errorText: { fontSize: FONTS.body.size, color: c.danger, textAlign: 'center' as const, marginBottom: 16 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.primary, borderRadius: 10 },
    retryText: { fontSize: FONTS.body.size, fontWeight: FONTS.body.weight as any, color: '#fff' },
    // Toolbar
    toolbar: {
      position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 100,
      height: 72,
      backgroundColor: 'rgba(20,20,22,0.88)',
      // @ts-ignore
      backdropFilter: 'blur(20px) saturate(1.5)',
      borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)',
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const,
      paddingBottom: 8,
    } as any,
    toolLabel: { fontSize: 10, color: c.textSub },
    toolBtn: { flex: 1, alignItems: 'center' as const, gap: 4, maxWidth: 90, paddingVertical: 8 } as any,
    toolSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0 },
    // Share sheet
    sheetOverlay: { position: 'fixed' as any, inset: 0, zIndex: 150, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' as const } as any,
    sheet: { backgroundColor: '#1E1E22', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 } as any,
    sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, alignSelf: 'center' as const, marginTop: 12, marginBottom: 16 },
    sheetTitle: { fontSize: 13, fontWeight: '600' as const, color: c.textSub, textAlign: 'center' as const, marginBottom: 16 },
    sheetGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: 8, marginBottom: 16 } as any,
    sheetItem: { flexBasis: '25%' as any, alignItems: 'center' as const, paddingVertical: 12, gap: 8 } as any,
    sheetIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const } as any,
    sheetItemLabel: { fontSize: 11, color: c.textSub },
    sheetCancel: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#26262C', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' as const } as any,
    sheetCancelText: { fontSize: 14, fontWeight: '500' as const, color: c.textSub },
    // Toast
    toastWrap: { position: 'absolute' as const, bottom: 88, left: 0, right: 0, alignItems: 'center' as const, zIndex: 200 } as any,
    toastBox: { backgroundColor: 'rgba(30,30,34,0.95)', backdropFilter: 'blur(16px)' as any, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 } as any,
    toastText: { fontSize: 12, color: c.textMain },
  });
};
