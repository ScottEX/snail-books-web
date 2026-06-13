import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { modalClose } from '../sharedStyles';

interface CloseButtonProps {
  onPress: () => void;
}

/** Modal header close button — ✕, white 70% opacity, 18px light weight.
 *  Uses the shared modalClose style for consistent appearance across all modals. */
export default function CloseButton({ onPress }: CloseButtonProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={modalClose}>✕</Text>
    </TouchableOpacity>
  );
}
