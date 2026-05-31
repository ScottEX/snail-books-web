import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable animated filter panel. Uses CSS transitions for web reliability.
 * Opens: backdrop fade-in + panel scale 0.95→1 + translateY -8→0 (200ms ease-out).
 * Closes: reverse (150ms) → calls onClose to unmount.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      // Force a frame delay so the browser registers the initial hidden state
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimating(false);
    }
  }, [visible]);

  const close = useCallback(() => {
    setAnimating(false);
    setTimeout(onClose, 150);
  }, [onClose]);

  if (!visible && !animating) return null;

  const panelStyle: any = {
    position: 'absolute', top: 72, left: 12, right: 12, zIndex: 9999,
    opacity: animating ? 1 : 0,
    transform: animating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  };

  return (
    <>
      {/* Backdrop */}
      <View
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998,
          opacity: animating ? 1 : 0,
          transition: 'opacity 0.2s ease-out',
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </View>

      {/* Panel */}
      <View style={panelStyle}>
        {children}
      </View>
    </>
  );
};
