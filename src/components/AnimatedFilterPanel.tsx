import React from 'react';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * DEBUG VERSION — bright red backdrop to confirm rendering.
 */
export const AnimatedFilterPanel: React.FC<Props> = ({ visible, onClose, children }) => {
  if (!visible) return null;

  return (
    <>
      {/* DEBUG: bright red backdrop — if you see this, the component IS rendering */}
      <View
        style={{
          position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255,0,0,0.3)', zIndex: 99999,
          borderWidth: 4, borderColor: 'red',
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </View>
      {/* DEBUG: green border panel */}
      <View
        style={{
          position: 'fixed' as any,
          top: 72, left: 12, right: 12,
          zIndex: 99999,
          backgroundColor: 'white',
          borderWidth: 3, borderColor: 'green',
          minHeight: 200,
        }}
      >
        {children}
      </View>
    </>
  );
};
