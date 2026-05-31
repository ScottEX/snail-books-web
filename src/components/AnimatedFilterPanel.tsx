import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable animated filter panel — matches ExpenseScreen picker animation.
 * Opens with spring (tension:300, friction:24): backdrop fade-in + panel scale 0.95→1 + translateY -8→0.
 * Closes with timing (150ms) reverse → calls onClose to unmount.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
    }
  }, [visible]);

  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }).start(onClose);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998,
          opacity: anim,
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1], extrapolate: 'clamp' }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </>
  );
};
