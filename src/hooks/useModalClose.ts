import { useState, useCallback } from 'react';

/**
 * Reusable modal close hook with exit animation support.
 * Returns { exiting, handleClose } — set exiting on the card style,
 * and call handleClose as the close handler.
 */
export function useModalClose(onClose: () => void, duration = 200) {
  const [exiting, setExiting] = useState(false);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onClose();
      setExiting(false);
    }, duration);
  }, [onClose, duration]);

  return { exiting, handleClose };
}

/** CSS object to apply on the modal card during exit animation. */
export const modalExitStyle = {
  animationName: 'modalOut',
  animationDuration: '0.18s',
  animationTimingFunction: 'ease',
  animationFillMode: 'forwards',
} as const;
