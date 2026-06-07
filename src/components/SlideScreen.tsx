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
  /**
   * Optional background color for the slide screen wrapper.
   * Use for screens that need a solid background (e.g. PDF preview).
   * Omit for transparent (frosted glass) screens.
   */
  backgroundColor?: string;
}

/**
 * iOS-style push/pop wrapper — slides in from right, slides out to left.
 */
export default function SlideScreen({
  visible, onClose, children,
  top = 0, stackIndex = 0, isTop = false,
  backgroundColor,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [render, setRender] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const zIndex = 100 + stackIndex * 10;

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
        backgroundColor: backgroundColor || 'transparent',
      }}
    >
      {children(close)}
    </Animated.View>
  );
}
