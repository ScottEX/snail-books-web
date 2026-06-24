import { View, TouchableOpacity, Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTheme, withAlpha, ThemeColors } from '../theme';

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function FilterPanel({ visible, onClose, children, style }: FilterPanelProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const { colors: c } = useTheme();
  const st = getStyles(c);

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 170,
        friction: 26,
      }).start();
    }
  }, [visible, anim]);

  const close = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          st.backdrop,
          { opacity: anim },
        ]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={{
          position: 'absolute' as any,
          top: 100,
          left: 12,
          right: 12,
          zIndex: 9999,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        }}
      >
        <View style={[st.panel, style]}>
          <View style={st.content}>
            {children}
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 9998,
    },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.secondary,
      overflow: 'hidden' as any,
    },
    content: {
      padding: 12,
      gap: 8,
    },
  });
