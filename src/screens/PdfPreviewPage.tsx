import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;  // 清 hash，App.tsx 处理
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

function ShareIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v13" />
    </Svg>
  );
}

function LinkIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState('');

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
          }
          setLoading(false);
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // [下载] 按钮：fetch blob + 触发下载，文件名 procurement_<id>.pdf
  const handleDownload = async () => {
    if (!tokenUrl || downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(tokenUrl);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      // createObjectURL → <a download> → 浏览器强制下载 + 自定义文件名
      // (绕过 iframe inline 显示路径，让用户拿到本地文件)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `procurement_${batchId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on next tick so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      showToast(t('pdfLoadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  // [分享] 按钮：navigator.share({files}) 真 PDF 附件
  // fallback：clipboard 复制 token URL（公开分享链接，24h 有效）
  const handleShare = async () => {
    if (!tokenUrl) return;
    try {
      const resp = await fetch(tokenUrl);
      if (!resp.ok) throw new Error('fetch failed');
      const blob = await resp.blob();
      const file = new File([blob], `procurement_${batchId}.pdf`, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `procurement_${batchId}` });
        return;
      }
      // Fallback: copy public link to clipboard
      const fullUrl = window.location.origin + tokenUrl;
      await navigator.clipboard.writeText(fullUrl);
      showToast(t('linkCopied'));
    } catch (e: any) {
      // User cancelled share sheet — silent
      if (e?.name !== 'AbortError') {
        showToast(t('shareFailed'));
      }
    }
  };

  // [复制链接] 按钮：把公开分享 URL 写到剪贴板
  const handleCopyLink = async () => {
    if (!tokenUrl) return;
    try {
      const fullUrl = window.location.origin + tokenUrl;
      await navigator.clipboard.writeText(fullUrl);
      showToast(t('linkCopied'));
    } catch {
      showToast(t('pdfLoadFailed'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Top bar: back + title */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <BackArrow color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {t('procPdfTitle').replace('{n}', String(batchNumber))}
        </Text>
      </View>

      {/* Action toolbar (frosted glass) */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.btn}
            onPress={handleDownload}
            disabled={!tokenUrl || downloading}
            activeOpacity={0.7}
          >
            <DownloadIcon color={colors.textMain} />
            <Text style={styles.btnText}>
              {downloading ? t('downloading') : t('download')}
            </Text>
          </TouchableOpacity>
          <View style={styles.btnSep} />
          <TouchableOpacity
            style={styles.btn}
            onPress={handleShare}
            disabled={!tokenUrl}
            activeOpacity={0.7}
          >
            <ShareIcon color={colors.textMain} />
            <Text style={styles.btnText}>{t('share')}</Text>
          </TouchableOpacity>
          <View style={styles.btnSep} />
          <TouchableOpacity
            style={styles.btn}
            onPress={handleCopyLink}
            disabled={!tokenUrl}
            activeOpacity={0.7}
          >
            <LinkIcon color={colors.textMain} />
            <Text style={styles.btnText}>{t('copyLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PDF viewer / loading / error */}
      <View style={styles.viewer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.hint, { marginTop: 12 }]}>{t('pdfLoading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onBack} style={styles.retryBtn} activeOpacity={0.7}>
              <Text style={styles.retryText}>{t('goBack')}</Text>
            </TouchableOpacity>
          </View>
        ) : tokenUrl ? (
          <>
            {/*
              iframe loads the public share URL (24h HMAC token). The
              server returns Content-Disposition: inline, so the
              browser's built-in PDF reader takes over (no download).
            */}
            <iframe
              src={tokenUrl}
              style={styles.iframe as any}
              title={`procurement_${batchId}.pdf`}
            />
            {/*
              Fallback message for browsers that can't render PDF
              inline (some mobile browsers, Chrome when configured to
              always-download PDFs). Hidden if iframe loads OK via
              onLoad; we use a simple "always shown but non-blocking"
              approach instead — it's a single line and the toolbar
              is the actual fallback.
            */}
          </>
        ) : null}
      </View>

      {/* Toast */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: c.bg,
    zIndex: 200,  // above all SlideScreens (which max at 100+stackIndex*10)
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(c.textMain, 0.08),
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FONTS.h2.size,
    fontWeight: FONTS.h2.weight,
    color: c.textMain,
    flex: 1,
  },
  toolbarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.bg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: withAlpha(c.textMain, 0.04),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(c.textMain, 0.06),
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  btnSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(c.textMain, 0.1),
  },
  btnText: {
    fontSize: FONTS.body.size,
    fontWeight: FONTS.body.weight,
    color: c.textMain,
  },
  viewer: {
    flex: 1,
    backgroundColor: c.bg,
  },
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: c.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  hint: {
    fontSize: FONTS.body.size,
    color: c.textSub,
  },
  errorText: {
    fontSize: FONTS.body.size,
    color: c.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: c.primary,
    borderRadius: 10,
  },
  retryText: {
    fontSize: FONTS.body.size,
    fontWeight: FONTS.body.weight,
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 0, right: 0,
    alignItems: 'center',
  },
  toastText: {
    backgroundColor: withAlpha(c.textMain, 0.9),
    color: c.bg,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: FONTS.body.size,
    fontWeight: FONTS.body.weight,
    overflow: 'hidden',
  },
});
