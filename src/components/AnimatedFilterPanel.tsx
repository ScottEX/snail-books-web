import React from 'react';
import { TouchableOpacity, Animated } from 'react-native';

interface Props {
  visible: boolean;
  anim: Animated.Value;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Filter panel — anim prop is owned by the parent page.
 * Parent MUST start the spring BEFORE setting visible=true, so the
 * Animated.View picks up the running animation when it mounts.
 *
 * Parent pattern:
 *   filterAnim.current.setValue(0);
 *   Animated.spring(filterAnim.current, { toValue:1, useNativeDriver:true }).start();
 *   setShowFilter(true);
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, anim, onClose, children }) => {
  if (!visible) return null;

  // Backdrop: fade in/out
  const backdropStyle = {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9998,
    opacity: anim,
  };

  // Panel: slide up from below + slight scale
  const panelStyle = {
    position: 'fixed' as any,
    top: 72, left: 12, right: 12,
    zIndex: 9999,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    overflow: 'hidden' as any,
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };

  return (
    <>
      <Animated.View style={backdropStyle}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={panelStyle}>
        {children}
      </Animated.View>
    </>
  );
};
