import { useRef, useCallback } from 'react';

/**
 * Swipe-right-from-left-edge to go back.
 * Usage: <View {...useSwipeBack(onBack)}> ... </View>
 */
export function useSwipeBack(onBack: () => void) {
  const touchRef = useRef({ startX: 0, startY: 0 });

  const onTouchStart = useCallback((e: any) => {
    const t = e.nativeEvent?.touches?.[0] || e.nativeEvent;
    touchRef.current = { startX: t.pageX, startY: t.pageY };
  }, []);

  const onTouchEnd = useCallback((e: any) => {
    const t = e.nativeEvent?.changedTouches?.[0] || e.nativeEvent;
    if (!t) return;
    const dx = t.pageX - touchRef.current.startX;
    const dy = Math.abs(t.pageY - touchRef.current.startY);
    if (touchRef.current.startX < 36 && dx > 80 && dx > dy * 1.5) onBack();
  }, [onBack]);

  return { onTouchStart, onTouchEnd };
}
