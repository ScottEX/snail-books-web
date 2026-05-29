import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, withAlpha, ThemeColors } from '../theme';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 3000 }: ToastProps) {
  const [show, setShow] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (visible && message) {
      setShow(true);
      const t = setTimeout(() => {
        setShow(false);
        setTimeout(onDismiss, 300); // wait for fade-out
      }, duration);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [visible, message, duration, onDismiss]);

  if (!show && !visible) return null;

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.overlay, { opacity: show ? 1 : 0 }]}>
      <View style={styles.box}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    position: 'absolute' as any,
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  box: {
    backgroundColor: withAlpha(colors.textMain, 0.88),
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    maxWidth: 320,
  },
  text: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
