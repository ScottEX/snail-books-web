import React, { useState, useRef, useEffect } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable animated filter panel — mirrors ExpenseScreen picker exactly.
 * Pattern: start spring → mount views → Animated.Value already in motion.
 * Uses useLayoutEffect so the spring fires before browser paint.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);
  const closingRef = useRef(false);

  // Open: start spring → then mount (matches expense page pattern)
  useEffect(() => {
    if (visible && !show && !closingRef.current) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }).start();
      setShow(true);
    }
  }, [visible, show]);

  // Close: reverse animation → unmount → notify parent
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShow(false);
      closingRef.current = false;
      onClose();
    });
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop — matches expense page line 1226 exactly */}
      <Animated.View
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998,
          opacity: anim,
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Panel — position:fixed (matches expense page) + transform */}
      <Animated.View
        style={{
          position: 'fixed' as any,
          top: 72, left: 12, right: 12,
          zIndex: 9999,
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </>
  );
};
