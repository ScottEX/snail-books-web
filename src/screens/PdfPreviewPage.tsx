import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Modal, Pressable, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

// ── Top-right share icon (in the nav bar) ──
function ShareIconSmall({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v13" />
    </Svg>
  );
}

// ── Share sheet action icons ──
function WeChatIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </Svg>
  );
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M12 15V3" />
    </Svg>
  );
}

function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  );
}

function ImageIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3h18v18H3z" />
      <Path d="M21 15l-5-5L5 21" />
      <Path d="M8.5 8.5a1.5 1.5 0 1 0 0 .01" />
    </Svg>
  );
}

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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
    setTimeout(() => setToast(''), 2200);
  };

  // Resolve the share-link token to a public URL on window.origin.
  // The token endpoint is login-required (so login_required=False
  // clients can be sent the link), but the /api/share/<token>
  // endpoint itself is unauthenticated — exactly the contract the
  // share sheet's mail/WeChat actions rely on.
  const publicUrl = tokenUrl
    ? (typeof window !== 'undefined' ? window.location.origin + tokenUrl : tokenUrl)
    : '';

  // ── Share-sheet actions ──
  // Each action shares the same data-fetching shape: fetch(tokenUrl)
  // → blob → do something. iOS Safari 14+ has a short blob URL
  // lifetime, so we always pass the raw File (not a blob URL) to
  // navigator.share — that's the C-pattern fix from before.
  const fetchBlob = async (): Promise<Blob | null> => {
    if (!tokenUrl) return null;
    const r = await fetch(tokenUrl);
    if (!r.ok) throw new Error('fetch failed');
    return await r.blob();
  };

  // 1) WeChat (actually: native share sheet, user picks WeChat on
  //    iOS / desktop). Falls back to copying the public link if
  //    navigator.canShare({files}) is unsupported.
  const handleWeChatShare = async () => {
    if (busyAction || !tokenUrl) return;
    setBusyAction('wechat');
    try {
      const blob = await fetchBlob();
      if (!blob) throw new Error('no blob');
      const file = new File([blob], `procurement_${batchId}.pdf`, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `procurement_${batchId}` });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        showToast(t('linkCopied'));
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        await navigator.clipboard?.writeText(publicUrl).catch(() => {});
        showToast(t('linkCopied'));
      }
    } finally {
      setBusyAction(null);
      setShareSheetOpen(false);
    }
  };

  // 2) Save as image — download the rendered PNG (server-rendered
  //    by PyMuPDF at /api/share/<token>/first-page.png). 2x scale
  //    makes it retina-grade; the resulting <a download> triggers
  //    the OS "save to photos" sheet on iOS.
  const handleSaveImage = async () => {
    if (busyAction || !tokenUrl) return;
    setBusyAction('image');
    try {
      const pngUrl = tokenUrl + '/first-page.png';
      const r = await fetch(pngUrl);
      if (!r.ok) throw new Error('png fetch failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `procurement_${batchId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      showToast(t('shareFailed'));
    } finally {
      setBusyAction(null);
      setShareSheetOpen(false);
    }
  };

  // 3) Download PDF
  const handleDownloadPdf = async () => {
    if (busyAction || !tokenUrl) return;
    setBusyAction('pdf');
    try {
      const blob = await fetchBlob();
      if (!blob) throw new Error('no blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `procurement_${batchId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      showToast(t('pdfLoadFailed'));
    } finally {
      setBusyAction(null);
      setShareSheetOpen(false);
    }
  };

  // 4) Email — mailto with a link. We can't attach a real PDF via
  //    mailto (browser limitation), so we send the 24h public link
  //    in the body. The recipient opens it in any browser to see
  //    the PDF.
  const handleEmail = async () => {
    if (!tokenUrl) return;
    const subject = encodeURIComponent(`procurement_${batchId}.pdf`);
    const body = encodeURIComponent(
      `${t('shareLink')}: ${publicUrl}\n\n${t('emailBodyExtra')}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShareSheetOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Top bar: back + title + share (frosted glass header, matches ProcurementDetailScreen) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <BackArrow color={colors.textMain} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {t('procPdfTitle').replace('{n}', String(batchNumber))}
        </Text>
        <TouchableOpacity
          onPress={() => setShareSheetOpen(true)}
          activeOpacity={0.7}
          disabled={!tokenUrl}
        >
          <View style={[styles.shareBtn, !tokenUrl && styles.shareBtnDisabled]}>
            <ShareIconSmall color={colors.textMain} />
          </View>
        </TouchableOpacity>
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
          <iframe
            src={tokenUrl}
            style={styles.iframe as any}
            title={`procurement_${batchId}.pdf`}
          />
        ) : null}
      </View>

      {/* Share sheet modal (frosted bottom sheet) */}
      <Modal
        visible={shareSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setShareSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShareSheetOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetGrid}>
              <ShareAction
                icon={<WeChatIcon color={colors.textMain} />}
                label={t('share')}
                onPress={handleWeChatShare}
                busy={busyAction === 'wechat'}
                colors={colors}
              />
              <ShareAction
                icon={<ImageIcon color={colors.textMain} />}
                label={t('saveImage')}
                onPress={handleSaveImage}
                busy={busyAction === 'image'}
                colors={colors}
              />
              <ShareAction
                icon={<DownloadIcon color={colors.textMain} />}
                label={t('downloadPdf')}
                onPress={handleDownloadPdf}
                busy={busyAction === 'pdf'}
                colors={colors}
              />
              <ShareAction
                icon={<MailIcon color={colors.textMain} />}
                label={t('emailAction')}
                onPress={handleEmail}
                busy={false}
                colors={colors}
              />
            </View>
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setShareSheetOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>{t('goBack')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Toast */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ShareAction({
  icon, label, onPress, busy, colors,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  busy: boolean;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={busy}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 8,
        opacity: busy ? 0.4 : 1,
      }}
    >
      {icon}
      <Text style={{
        fontSize: FONTS.sub.size,
        color: colors.textMain,
        fontWeight: FONTS.sub.weight,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.bg,
      zIndex: 200,
    },
    ...hdr,
    // Right-side share button — 44×44 frosted glass circle, mirrors backBtn
    shareBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: withAlpha(c.bg, 0.30),
      justifyContent: 'center' as const, alignItems: 'center' as const,
      // @ts-ignore
      backdropFilter: 'saturate(200%) blur(30px)',
      borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
    },
    shareBtnDisabled: { opacity: 0.4 },
    viewer: {
      flex: 1,
      backgroundColor: c.bg,
      marginTop: 100, // space for glass header + clearance (matches ProcurementDetailScreen)
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
  // Share sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 24 : 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: withAlpha(c.textMain, 0.18),
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sheetCancel: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: withAlpha(c.textMain, 0.05),
    borderRadius: 12,
  },
  sheetCancelText: {
    fontSize: FONTS.body.size,
    fontWeight: FONTS.body.weight,
    color: c.textMain,
  },
  // Toast (floats above iframe & share sheet, 2.2s self-dismiss)
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
};
