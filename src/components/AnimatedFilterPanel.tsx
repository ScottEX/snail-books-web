import React from 'react';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * NO-ANIMATION version — just to verify the component renders correctly.
 * Backdrop + panel appear instantly when visible=true.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  if (!visible) return null;

  return (
    <>
      <View
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 9998,
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </View>
      <View
        style={{
          position: 'fixed' as any,
          top: 72, left: 12, right: 12,
          zIndex: 9999,
        }}
      >
        {children}
      </View>
    </>
  );
};
