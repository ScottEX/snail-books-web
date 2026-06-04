import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';
import ThemePicker from './ThemePicker';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
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
  });
}

export default function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
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

  return createPortal(
    <Animated.View style={[styles.overlay as any, { opacity: fade }]}>
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} onPress={handleClose}>
        <Animated.View style={[styles.card as any, { transform: [{ translateY: slide }] }]}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('themeLabel') || '主题'}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.body}>
              <ThemePicker onSelect={handleClose} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>,
    document.body
  );
}
