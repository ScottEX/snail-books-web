import { View, TouchableOpacity, Animated } from 'react-native';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { CONTENT_MAX_WIDTH } from '../theme';

/** Fullscreen animated overlay for canvas-based crop modals.
 *  Unlike ModalOverlay, children are rendered as direct siblings of the
 *  backdrop — no intermediate Animated.View wrapper whose CSS transform
 *  would create a containing block and break canvas dimensions. */
export default function FullscreenOverlay({
  visible = true,
  onClose,
  children,
  backdropColor = 'rgba(8,8,12,0.92)',
}: {
  visible?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backdropColor?: string;
}) {
  const [show, setShow] = useState(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const back = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      scale.setValue(0.85);
      fade.setValue(0);
      back.setValue(0);
      Animated.parallel([
        Animated.timing(back, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 8, speed: 14 }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();
    } else if (show) {
      Animated.parallel([
        Animated.timing(back, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(scale, { toValue: 0.92, duration: 220, useNativeDriver: false }),
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: false }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return createPortal(
    <View style={{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, maxWidth: CONTENT_MAX_WIDTH, marginLeft: 'auto' as any, marginRight: 'auto' as any }}>
      {/* Backdrop */}
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: backdropColor, opacity: back as any } as any} />
      </TouchableOpacity>
      {/* Content — direct sibling, no intermediate Animated.View wrapper */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fade as any, transform: [{ scale } as any] } as any}>
        {children}
      </Animated.View>
    </View>,
    document.body,
  );
}
