import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t } from '../i18n';

import ThemePicker from './ThemePicker';
import CloseButton from './CloseButton';
import BgCropModal from './BgCropModal';
import ModalOverlay from './ModalOverlay';
import { useTheme, ThemeColors, FONTS } from '../theme';
import { useRef, useState } from 'react';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
  // Theme tools
  showCoverTools?: boolean;
  coverOpacity?: number;
  onCoverOpacityChange?: (v: number) => void;
  // NEW: receives a cropped File when user confirms in the BgCropModal preview.
  // Caller is responsible for uploading (e.g. api.uploadBackground).
  onCoverImagePicked?: (file: File) => Promise<void> | void;
  onResetCover?: () => void;
  coverUploading?: boolean;
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      width: 340, maxWidth: '90%', overflow: 'hidden' as any,
    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: 700, color: colors.surface },
    body: { padding: 20, paddingTop: 16, gap: 0 } as any,
    hint: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 20 },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 } as any,
    bgBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    bgBtnOutline: {
      borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent',
    },
    bgBtnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    bgBtnDanger: {
      borderWidth: 1, borderColor: colors.danger, backgroundColor: 'transparent',
    },
    bgBtnDangerText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  });
}

export default function ThemePickerModal({
  visible, onClose,
  showCoverTools, coverOpacity, onCoverOpacityChange,
  onCoverImagePicked, onResetCover, coverUploading,
}: ThemePickerModalProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [showCrop, setShowCrop] = useState(false);
  // imageSrc is the dataURL the user picked via the file input. It is
  // passed to BgCropModal, which loads it into the canvas. The file
  // picker lives HERE (not inside BgCropModal) so that clicking the
  // "选择图片" button opens the system file dialog immediately, before
  // the crop modal is rendered — the user should not see a crop modal
  // appear before they've even picked an image.
  const [imageSrc, setImageSrc] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClose = () => {
    setShowCrop(false);
    setImageSrc('');
    onClose();
  };

  // File picker lives here. Clicking the "选择图片" button triggers
  // the system file dialog directly; we DON'T show the crop modal
  // first. Once the user picks a file, we convert it to a dataURL and
  // then open the crop modal.
  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    try { e.target.value = ''; } catch {}
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (typeof data === 'string' && data.startsWith('data:')) {
        setImageSrc(data);
        setShowCrop(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const opacityValue = coverOpacity ?? 1;
  const opacityPct = Math.round(opacityValue * 100);

  return (
    <>
      <ModalOverlay visible={visible} onClose={handleClose} animation="springScale">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{showCoverTools ? t('bgSettings') : (t('themeLabel') || '主题')}</Text>
            <CloseButton onPress={handleClose} />
          </View>
          <View style={styles.body}>

            {/* ── Cover image tools (ProfileScreen only) ── */}
            {showCoverTools && (
              <Text style={styles.hint}>{t('bgHint')}</Text>
            )}

            {/* ── Theme Picker ── */}
            <View style={{ marginTop: showCoverTools ? 12 : 0 }}>
              <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginBottom: 10 }}>
                {t('themePicker') || '主题'}
              </Text>
              <ThemePicker onSelect={handleClose} />
            </View>

            {/* ── Opacity slider (ProfileScreen only) ── */}
            {showCoverTools && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight }}>{t('opacity')}</Text>
                  <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.primary }}>{opacityPct}%</Text>
                </View>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacityValue}
                    onChange={(e: any) => onCoverOpacityChange?.(parseFloat(e.target.value))}
                    style={{
                      width: '100%', height: 4, appearance: 'none' as any,
                      accentColor: colors.primary,
                      background: `linear-gradient(to right, ${colors.primary} ${opacityPct}%, ${colors.secondary} ${opacityPct}%)`,
                      borderRadius: 2, margin: 0,
                    }}
                  />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub }}>0</Text>
                  <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub }}>50</Text>
                  <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub }}>100</Text>
                </View>
              </View>
            )}

            {/* ── Image buttons (ProfileScreen only) ── */}
            {showCoverTools && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.bgBtn, styles.bgBtnOutline]}
                  disabled={coverUploading}
                  onPress={handlePickImage}
                >
                  <Text style={styles.bgBtnOutlineText}>{coverUploading ? t('uploading') : t('chooseImage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bgBtn, styles.bgBtnDanger]}
                  disabled={coverUploading}
                  onPress={onResetCover}
                >
                  <Text style={styles.bgBtnDangerText}>{t('resetDefault')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ModalOverlay>

      {/* ── File input (hidden) — must be in DOM for click() to work ── */}
      <input
        ref={fileInputRef as any}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* ── Background image crop modal (self-contained, renders via createPortal) ── */}
      <BgCropModal
        visible={showCrop}
        onClose={() => { setShowCrop(false); setImageSrc(''); }}
        imageSrc={imageSrc}
        onClearImage={() => setImageSrc('')}
        onUploaded={handleClose}
        onConfirm={async (blob) => {
          if (!onCoverImagePicked) return;
          const file = new File([blob], 'background.jpg', { type: blob.type || 'image/jpeg' });
          await onCoverImagePicked(file);
          setShowCrop(false);
          setImageSrc('');
        }}
      />
    </>
  );
}
