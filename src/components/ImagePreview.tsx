import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, ScrollView, Image, Platform, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../theme';

const SPRING = { friction: 8, tension: 60 };
const DISMISS_THRESHOLD = 80;
const DISMISS_VELOCITY = 0.4;
const OPEN_DURATION = 220;
const CLOSE_DURATION = 200;
const SNAP_DURATION = 220;

interface ImagePreviewProps {
  images: string[];
  initialIdx?: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImagePreview({
  images,
  initialIdx = 0,
  visible,
  onClose,
}: ImagePreviewProps) {
  const { width: WINDOW_W, height: WINDOW_H } = useWindowDimensions();
  const [idx, setIdx] = useState(initialIdx);
  const [dismissing, setDismissing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Animated values ──
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.92)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // ── Gesture refs ──
  const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');

  // ── ① Mount: fade + scale ──
  useEffect(() => {
    overlayOpacity.setValue(0);
    imageScale.setValue(0.92);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: false }),
      Animated.spring(imageScale, { ...SPRING, toValue: 1, useNativeDriver: false }),
    ]).start();
  }, []);

  // ── Scroll to initial index ──
  useEffect(() => {
    if (WINDOW_W > 0) {
      scrollRef.current?.scrollTo({ x: initialIdx * WINDOW_W, animated: false });
    }
  }, [initialIdx, WINDOW_W]);

  // ── Close ──
  const animateClose = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }),
      Animated.spring(imageScale, { ...SPRING, toValue: 0.92, useNativeDriver: false }),
    ]).start(() => onClose());
  }, [dismissing, overlayOpacity, imageScale, onClose]);

  // ── PanResponder — vertical dismiss only ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !dismissing,
    onMoveShouldSetPanResponder: (_, gs) =>
      !dismissing && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5 && Math.abs(gs.dy) > 20,

    onPanResponderGrant: () => {
      panY.stopAnimation();
      panY.setValue(0);
    },

    onPanResponderMove: (_, gs) => {
      const dy = gs.dy;
      const resistance = dy / (1 + Math.abs(dy) / 250);
      panY.setValue(resistance);

      const scaleProgress = Math.min(Math.abs(dy) / 350, 1);
      imageScale.setValue(1 - scaleProgress * 0.08);

      const fadeProgress = Math.pow(Math.min(Math.abs(dy) / (DISMISS_THRESHOLD * 1.3), 1), 1.6);
      overlayOpacity.setValue(1 - fadeProgress * 0.55);
    },

    onPanResponderRelease: (_, gs) => {
      const fastFling = gs.vy > DISMISS_VELOCITY;
      const overThreshold = gs.dy > DISMISS_THRESHOLD;

      if (overThreshold || (fastFling && gs.dy > 30)) {
        setDismissing(true);
        Animated.parallel([
          Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }),
          Animated.timing(panY, { toValue: WINDOW_H * 0.5, duration: CLOSE_DURATION, useNativeDriver: false }),
          Animated.spring(imageScale, { ...SPRING, toValue: 0.92, useNativeDriver: false }),
        ]).start(() => onClose());
      } else {
        Animated.parallel([
          Animated.timing(panY, { toValue: 0, duration: SNAP_DURATION, useNativeDriver: false }),
          Animated.spring(imageScale, { ...SPRING, toValue: 1, useNativeDriver: false }),
          Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: false }),
        ]).start();
      }
    },
  }), [dismissing, panY, overlayOpacity, imageScale, WINDOW_H, onClose]);

  if (!visible || images.length === 0 || WINDOW_W === 0) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} {...panResponder.panHandlers}>
      {/* Close button */}
      <TouchableOpacity style={styles.close} onPress={animateClose} activeOpacity={0.7}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>

      {/* Paged ScrollView — native horizontal swipe */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          const raw = offsetX / WINDOW_W;
          const page = Math.round(raw);
          if (page >= 0 && page < images.length && page !== idx) {
            setIdx(page);
          }
        }}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {images.map((src, i) => (
          <Animated.View
            key={i}
            style={[styles.page, { width: WINDOW_W, transform: [{ scale: imageScale }] }]}
          >
            <ImageElement src={src} />
          </Animated.View>
        ))}
      </ScrollView>

      {/* Counter — dots */}
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** Platform-aware image element */
function ImageElement({ src }: { src: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('img', {
      src,
      draggable: false as any,
      style: {
        width: '100vw', maxHeight: '90vh', objectFit: 'contain',
        pointerEvents: 'none' as any,

      },
      alt: 'preview',
    });
  }
  return (
    <Image
      source={{ uri: src }}
      style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  counter: {
    position: 'absolute', bottom: 60, alignSelf: 'center', zIndex: 10,
    fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)',
  },
  dots: {
    position: 'absolute' as any, bottom: 60, alignSelf: 'center', zIndex: 10,
    flexDirection: 'row' as any, gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
