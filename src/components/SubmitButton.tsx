import { Text, TouchableOpacity, ActivityIndicator, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';

interface SubmitButtonProps {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function SubmitButton({
  onPress,
  loading,
  disabled = false,
  label,
  children,
  style,
  textStyle,
}: SubmitButtonProps) {
  return (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : children ? (
        children
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
