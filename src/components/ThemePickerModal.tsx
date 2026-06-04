import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors, FONTS } from '../theme';
import { t } from '../i18n';
import ThemePicker from './ThemePicker';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
  // Optional cover tools (for ProfileScreen)
  showCoverTools?: boolean;
  coverOpacity?: number;
  onCoverOpacityChange?: (v: number) => void;
  onChooseCover?: () => void;
  onResetCover?: () => void;
  coverUploading?: boolean;
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'fixed' as any, inset: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center', alignItems: 'center', zIndex: 500,
    },
    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      width: 360, maxWidth: '90%', overflow: 'hidden' as any,
    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.surface },
    closeBtn: { fontSize: 18, color: colors.surface, lineHeight: 20 },
    body: { padding: 20, gap: 8 } as any,
    hint: { fontSize: FONTS.sub.size, color: colors.textSub, fontWeight: FONTS.sub.weight, marginBottom: 4 },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    btn: {
      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' as any,
      borderWidth: 1, borderColor: colors.primary,
    },
    btnOutlineText: { fontSize: FONTS.sub.size, color: colors.primary, fontWeight: FONTS.sub.weight },
    btnDanger: { borderColor: '#e06464' },
    btnDangerText: { fontSize: FONTS.sub.size, color: '#e06464', fontWeight: FONTS.sub.weight },
  });
}

export default function ThemePickerModal({
  visible, onClose,
  showCoverTools, coverOpacity, onCoverOpacityChange,
  onChooseCover, onResetCover, coverUploading,
}: ThemePickerModalProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-300)).current;
  const [show, setShow] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      fade.setValue(0);
      slide.setValue(-300);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (show) {
      Animated.parallel([
        Animated.timing(slide, { toValue: -300, duration: 180, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -300, duration: 180, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => { setShow(false); onClose(); });
  };

  if (!show) return null;

  const opacityValue = coverOpacity ?? 1;
  const opacityPct = Math.round(opacityValue * 100);

  return createPortal(
    <Animated.View style={[styles.overlay as any, { opacity: fade }]}>
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} onPress={handleClose}>
        <Animated.View style={[styles.card as any, { transform: [{ translateY: slide }] }]}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{showCoverTools ? t('bgSettings') : (t('themeLabel') || '主题')}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.body}>

              {/* ── Cover image tools (ProfileScreen only) ── */}
              {showCoverTools && (
                <>
                  <Text style={styles.hint}>{t('bgHint')}</Text>
                </>
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
                  <View style={{ position: 'relative', height: 32, justifyContent: 'center' }}>
                    <View style={{
                      position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
                      backgroundColor: colors.secondary,
                    }} />
                    <View style={{
                      position: 'absolute', left: 0, height: 4, borderRadius: 2,
                      width: `${opacityPct}%`,
                      backgroundColor: colors.primary,
                    }} />
                    <input
                      type="range"
                      className="glass-slider"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacityValue}
                      onChange={(e: any) => onCoverOpacityChange?.(parseFloat(e.target.value))}
                      style={{
                        width: '100%', height: 32, opacity: 0, cursor: 'pointer',
                        margin: 0, position: 'relative', zIndex: 1,
                      }}
                    />
                  </View>
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
                    style={styles.btn}
                    disabled={coverUploading}
                    onPress={onChooseCover}
                  >
                    <Text style={styles.btnOutlineText}>{coverUploading ? t('uploading') : t('chooseImage')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDanger]}
                    disabled={coverUploading}
                    onPress={onResetCover}
                  >
                    <Text style={styles.btnDangerText}>{t('resetDefault')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>,
    document.body
  );
}
