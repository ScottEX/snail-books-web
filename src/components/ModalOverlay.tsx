import { View, TouchableOpacity, Animated } from 'react-native';
import { createPortal } from 'react-dom';
import { MODAL_BACKDROP_OPACITY } from '../theme';
import { useEffect, useRef, useState } from 'react';

interface ModalOverlayProps {
  visible?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayStyle?: any;
  contentStyle?: any;
  /** 动画类型：'slide' 默认顶部滑入、'springScale' 弹性缩放、'blurMorph' 模糊渐显 */
  animation?: 'slide' | 'springScale' | 'blurMorph';
}

/** Uniform spring-animated modal overlay used by all modals across the app. */
export default function ModalOverlay({ visible = true, onClose, children, overlayStyle, contentStyle, animation = 'slide' }: ModalOverlayProps) {
  const [show, setShow] = useState(false);
  const slide = useRef(new Animated.Value(animation === 'springScale' ? 12 : -300)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(animation === 'springScale' ? 0.85 : animation === 'blurMorph' ? 1.04 : 1)).current;
  const blur = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      if (animation === 'springScale') {
        scale.setValue(0.85);
        slide.setValue(12);
        fade.setValue(0);
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 8, speed: 14 }),
          Animated.spring(slide, { toValue: 0, useNativeDriver: false, bounciness: 8, speed: 14 }),
          Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: false }),
        ]).start();
      } else if (animation === 'blurMorph') {
        scale.setValue(1.04);
        blur.setValue(8);
        fade.setValue(0);
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(blur, { toValue: 0, duration: 400, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: false }),
        ]).start();
      } else {
        slide.setValue(-300);
        fade.setValue(0);
        Animated.parallel([
          Animated.spring(slide, { toValue: 0, useNativeDriver: false, bounciness: 4, speed: 14 }),
          Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start();
      }
    } else if (show) {
      if (animation === 'springScale') {
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.92, duration: 220, useNativeDriver: false }),
          Animated.timing(slide, { toValue: 8, duration: 220, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: false }),
        ]).start(() => setShow(false));
      } else if (animation === 'blurMorph') {
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.97, duration: 250, useNativeDriver: false }),
          Animated.timing(blur, { toValue: 4, duration: 200, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: false }),
        ]).start(() => setShow(false));
      } else {
        Animated.parallel([
          Animated.timing(slide, { toValue: -300, duration: 180, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: false }),
        ]).start(() => setShow(false));
      }
    }
  }, [visible]);

  if (!show) return null;

  const getTrans = () => {
    if (animation === 'springScale') return [{ scale }, { translateY: slide }];
    if (animation === 'blurMorph') return [{ scale }];
    return [{ translateY: slide }];
  };

  const contentEx = animation === 'blurMorph'
    ? { filter: blur.interpolate({ inputRange: [0, 8], outputRange: ['blur(0px)', 'blur(8px)'] }) } as any
    : {};

  return createPortal(
    <Animated.View style={[{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 16 }, { opacity: fade }, overlayStyle]}>
      <TouchableOpacity activeOpacity={1} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: MODAL_BACKDROP_OPACITY }} onPress={onClose} />
      <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, contentStyle, { transform: getTrans() }, contentEx]}>
        {children}
      </Animated.View>
    </Animated.View>,
    document.body,
  );
}
