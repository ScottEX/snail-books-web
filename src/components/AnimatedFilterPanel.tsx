import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable animated filter panel — matches ExpenseScreen picker animation exactly.
 * Backdrop and panel are siblings (not nested), both driven by same anim value.
 * Always mounted so the Animated.Value stays connected to the views.
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
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(onClose);
  };

  return (
    <>
      {/* Backdrop — sibling, not parent of panel */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.08)',
          zIndex: visible ? 9998 : -1,
          opacity: anim,
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Panel — sibling, matches expense page pattern */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={{
          position: 'absolute' as any,
          top: 72, left: 12, right: 12,
          zIndex: visible ? 9999 : -1,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
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
