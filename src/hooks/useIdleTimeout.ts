import { useEffect, useRef } from 'react';

export function useIdleTimeout(onTimeout: () => void, minutes = 120) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onTimeout, minutes * 60_000);
    };

    // Reset on any user interaction
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    reset(); // Start initial timer

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onTimeout, minutes]);
}
