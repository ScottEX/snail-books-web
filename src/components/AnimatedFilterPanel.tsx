import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Animated filter panel — pure CSS transitions, no RN Animated.
 * Mounts hidden → double-RAF → transitions visible. Close reverses → unmounts.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  // Open: mount → wait for paint → transition in
  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Double rAF ensures the browser paints the initial hidden state before we transition
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [visible]);

  // Close: transition out → wait for transition → unmount
  const close = () => {
    setShow(false);
    setTimeout(() => {
      setMounted(false);
      onClose();
    }, 200); // match CSS transition duration
  };

  if (!mounted) return null;

  const backdropStyle: any = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 9998,
    opacity: show ? 1 : 0,
    transition: 'opacity 0.2s ease-out',
  };

  const panelStyle: any = {
    position: 'fixed',
    top: 72, left: 12, right: 12,
    zIndex: 9999,
    opacity: show ? 1 : 0,
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-8px)',
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  };

  return (
    <>
      <View style={backdropStyle}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </View>
      <View style={panelStyle}>
        {children}
      </View>
    </>
  );
};
