import { TouchableOpacity, Animated } from 'react-native';
import { createPortal } from 'react-dom';
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

/** Uniform animated modal overlay. Backdrop uses reference-style rgba(20,18,16,0.45). */
export default function ModalOverlay({ visible = true, onClose, children, overlayStyle, contentStyle, animation = 'slide' }: ModalOverlayProps) {
  const [show, setShow] = useState(false);
  const slide = useRef(new Animated.Value(animation === 'springScale' ? 12 : -300)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(animation === 'springScale' ? 0.85 : animation === 'blurMorph' ? 1.04 : 1)).current;
  const back = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      back.setValue(0);
      if (animation === 'springScale') {
        scale.setValue(0.85);
        slide.setValue(12);
        fade.setValue(0);
        Animated.parallel([
          Animated.timing(back, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 8, speed: 14 }),
          Animated.spring(slide, { toValue: 0, useNativeDriver: false, bounciness: 8, speed: 14 }),
          Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: false }),
        ]).start();
      } else if (animation === 'blurMorph') {
        scale.setValue(1.04);
        fade.setValue(0);
        Animated.parallel([
          Animated.timing(back, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: false }),
        ]).start();
      } else {
        slide.setValue(-300);
        fade.setValue(0);
        Animated.parallel([
          Animated.timing(back, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.spring(slide, { toValue: 0, useNativeDriver: false, bounciness: 4, speed: 14 }),
          Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start();
      }
    } else if (show) {
      const backOut = Animated.sequence([
        Animated.delay(50),
        Animated.timing(back, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]);
      if (animation === 'springScale') {
        Animated.parallel([
          backOut,
          Animated.timing(scale, { toValue: 0.92, duration: 220, useNativeDriver: false }),
          Animated.timing(slide, { toValue: 8, duration: 220, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: false }),
        ]).start(() => setShow(false));
      } else if (animation === 'blurMorph') {
        Animated.parallel([
          backOut,
          Animated.timing(scale, { toValue: 0.97, duration: 250, useNativeDriver: false }),
          Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: false }),
        ]).start(() => setShow(false));
      } else {
        Animated.parallel([
          backOut,
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

  return createPortal(
    <Animated.View style={[{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 16 }, overlayStyle]}>
      <TouchableOpacity activeOpacity={1} onPress={onClose}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,18,16,0.45)', opacity: back as any } as any} />
      </TouchableOpacity>
      <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, contentStyle, { opacity: fade, transform: getTrans() }]}>
        {children}
      </Animated.View>
    </Animated.View>,
    document.body,
  );
}
