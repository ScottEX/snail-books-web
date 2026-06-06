import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: (close: () => void) => React.ReactNode;
  top?: number;
  /**
   * Position in the page stack. 0 = bottom, increases upward.
   * Used to compute zIndex so the top of the stack always covers
   * the pages below it (fixes the bug where opening profile from
   * a history page put profile UNDER the history page).
   */
  stackIndex?: number;
  /**
   * True for the topmost page in the stack. When false, the page
   * is set to `pointerEvents="none"` so all touches pass through
   * to the page above (avoids stale onBack from a page the user
   * can't actually see).
   */
  isTop?: boolean;
}

/**
 * iOS-style push/pop wrapper — slides in from right, slides out to left.
 * Usage:
 *   <SlideScreen visible={show} onClose={() => setShow(false)} stackIndex={0} isTop>
 *     {(onBack) => <SomeScreen onBack={onBack} />}
 *   </SlideScreen>
 */
export default function SlideScreen({ visible, onClose, children, top = 0, stackIndex = 0, isTop = false }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [render, setRender] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  // 100 is the base z-index; each stack level adds 10. So a stack of
  // [profile, recon, proc] gives zIndex 100, 110, 120 — proc is on top
  // and the user can never tap through to anything below it.
  const zIndex = 100 + stackIndex * 10;

  // In / Out
  // Because pageStack.map only renders pages that are currently in
  // the stack, a SlideScreen instance mounts EXACTLY when its page
  // is pushed. So every visible=true mount corresponds to a fresh
  // push → always animate in from the right (iOS push behavior).
  // Pages deeper in the stack (already mounted) stay at translateX=0
  // — they're covered by the top page until it slides out.
  useEffect(() => {
    if (visible) {
      setRender(true);
      translateX.setValue(screenWidth);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (render) {
      // Animate out when parent sets visible=false
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setRender(false);
        onClose();
      });
    }
  }, [visible, screenWidth]);

  // Out
  const close = useCallback(() => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRender(false);
      onClose();
    });
  }, [onClose, screenWidth]);

  if (!render) return null;

  return (
    <Animated.View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={{
        position: 'absolute', top, left: 0, right: 0, bottom: 0,
        transform: [{ translateX }],
        zIndex,
      }}
    >
      {children(close)}
    </Animated.View>
  );
}
