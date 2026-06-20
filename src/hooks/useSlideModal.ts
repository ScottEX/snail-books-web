import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Shared slide-from-top modal animation — reuse across all modals.
 * 
 * Entry: spring slide down + overlay fade in (bounciness: 4, speed: 14, overlay 200ms)
 * Exit:  slide up + overlay fade out (180ms), then calls hide callback.
 *
 * Usage:
 *   const { modalSlide, modalOverlay, open, close } = useSlideModal();
 *   open(() => setVisible(true));           // show modal with animation
 *   close(() => setVisible(false));         // hide modal with animation
 */
export default function useSlideModal() {
  const modalSlide = useRef(new Animated.Value(0)).current;
  const modalOverlay = useRef(new Animated.Value(0)).current;

  const open = (show: () => void) => {
    show();
    modalSlide.setValue(-300);
    modalOverlay.setValue(0);
    Animated.parallel([
      Animated.spring(modalSlide, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
      Animated.timing(modalOverlay, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const close = (hide: () => void) => {
    Animated.parallel([
      Animated.timing(modalSlide, { toValue: -300, duration: 180, useNativeDriver: true }),
      Animated.timing(modalOverlay, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => hide());
  };

  return { modalSlide, modalOverlay, open, close } as const;
}
