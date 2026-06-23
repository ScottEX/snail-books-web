import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../theme';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');

// ── Animation presets ──
const SPRING = { friction: 8, tension: 60 };
const SWITCH_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);  // smooth ease-in-out
const SNAP_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);     // slight overshoot settle
const DISMISS_THRESHOLD = 80;
const DISMISS_VELOCITY = 0.4;
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;
const OPEN_DURATION = 220;
const CLOSE_DURATION = 200;
const SWITCH_DURATION = 250;
const SNAP_DURATION = 220;

// Static Animated.Values for layout arithmetic
const NEG_W = new Animated.Value(-WINDOW_W);
const POS_W = new Animated.Value(WINDOW_W);

interface ImagePreviewProps {
  images: string[];
  initialIdx?: number;
  visible: boolean;
  onClose: () => void;
}

/** Preload an image into browser cache */
function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

export default function ImagePreview({
  images,
  initialIdx = 0,
  visible,
  onClose,
}: ImagePreviewProps) {
  const [idx, setIdx] = useState(initialIdx);
  const [dismissing, setDismissing] = useState(false);

  // ── Animated values ──
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.92)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // ── Gesture refs ──
  const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');

  // ── Preload adjacent images ──
  useEffect(() => {
    if (idx > 0) preloadImage(images[idx - 1]);
    if (idx < images.length - 1) preloadImage(images[idx + 1]);
  }, [idx, images]);

  // ── ① Mount: fade timing + scale spring ──
  useEffect(() => {
    overlayOpacity.setValue(0);
    imageScale.setValue(0.92);
    panX.setValue(0);
    panY.setValue(0);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { ...SPRING, toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Close ──
  const animateClose = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { ...SPRING, toValue: 0.92, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [dismissing, overlayOpacity, imageScale, onClose]);

  // ── ④ Horizontal switch — timing + bezier, native driver ──
  const switchTo = useCallback((newIdx: number, dir: 'left' | 'right') => {
    panX.stopAnimation();
    const target = dir === 'left' ? -WINDOW_W : WINDOW_W;
    Animated.timing(panX, {
      toValue: target,
      duration: SWITCH_DURATION,
      easing: SWITCH_EASING,
      useNativeDriver: true,
    }).start(() => {
      setIdx(newIdx);
      panX.setValue(0);
    });
  }, [panX]);

  // ── PanResponder ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !dismissing,
    onMoveShouldSetPanResponder: (_, gs) =>
      !dismissing && (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6),

    onPanResponderGrant: () => {
      panX.stopAnimation();
      panY.stopAnimation();
      gestureType.current = 'none';
    },

    onPanResponderMove: (_, gs) => {
      if (gestureType.current === 'none') {
        if (Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 8) {
          gestureType.current = 'horizontal';
        } else if (Math.abs(gs.dy) > 8) {
          gestureType.current = 'vertical';
        }
      }

      if (gestureType.current === 'horizontal') {
        const blockedLeft = gs.dx > 0 && idx === 0;
        const blockedRight = gs.dx < 0 && idx === images.length - 1;
        if (blockedLeft || blockedRight) {
          panX.setValue(gs.dx * 0.25);
        } else {
          panX.setValue(gs.dx);
        }
      } else if (gestureType.current === 'vertical') {
        const dy = gs.dy;
        const resistance = dy / (1 + Math.abs(dy) / 250);
        panY.setValue(resistance);

        const scaleProgress = Math.min(Math.abs(dy) / 350, 1);
        imageScale.setValue(1 - scaleProgress * 0.08);

        const fadeProgress = Math.pow(Math.min(Math.abs(dy) / (DISMISS_THRESHOLD * 1.3), 1), 1.6);
        overlayOpacity.setValue(1 - fadeProgress * 0.55);
      }
    },

    onPanResponderRelease: (_, gs) => {
      if (gestureType.current === 'horizontal') {
        const blockedLeft = gs.dx > 0 && idx === 0;
        const blockedRight = gs.dx < 0 && idx === images.length - 1;
        const fastFling = Math.abs(gs.vx) > SWIPE_VELOCITY;
        const overThreshold = Math.abs(gs.dx) > SWIPE_THRESHOLD;

        if (!blockedLeft && !blockedRight && (overThreshold || fastFling)) {
          const newIdx = (gs.dx > 0 || gs.vx > 0) ? idx - 1 : idx + 1;
          const dir = (gs.dx > 0 || gs.vx > 0) ? 'right' : 'left';
          switchTo(newIdx, dir);
        } else {
          // Snap back — timing with slight overshoot easing
          Animated.timing(panX, {
            toValue: 0,
            duration: SNAP_DURATION,
            easing: SNAP_EASING,
            useNativeDriver: true,
          }).start();
        }
      } else if (gestureType.current === 'vertical') {
        const fastFling = gs.vy > DISMISS_VELOCITY;
        const overThreshold = gs.dy > DISMISS_THRESHOLD;

        if (overThreshold || (fastFling && gs.dy > 30)) {
          setDismissing(true);
          Animated.parallel([
            Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
            Animated.timing(panY, {
              toValue: WINDOW_H * 0.5,
              duration: CLOSE_DURATION,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.spring(imageScale, { ...SPRING, toValue: 0.92, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          Animated.parallel([
            Animated.timing(panY, {
              toValue: 0,
              duration: SNAP_DURATION,
              easing: SNAP_EASING,
              useNativeDriver: true,
            }),
            Animated.spring(imageScale, { ...SPRING, toValue: 1, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]).start();
        }
      }

      gestureType.current = 'none';
    },
  }), [idx, images.length, dismissing, switchTo, panX, panY, overlayOpacity, imageScale, onClose]);

  if (!visible || images.length === 0) return null;

  const showPrev = idx > 0;
  const showNext = idx < images.length - 1;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} {...panResponder.panHandlers}>
      {/* Close button */}
      <TouchableOpacity style={styles.close} onPress={animateClose} activeOpacity={0.7}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>

      {/* Left arrow */}
      {showPrev && (
        <TouchableOpacity style={styles.arrowLeft} onPress={() => switchTo(idx - 1, 'right')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
      )}

      {/* Right arrow */}
      {showNext && (
        <TouchableOpacity style={styles.arrowRight} onPress={() => switchTo(idx + 1, 'left')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      )}

      {/* ── Previous image — sits at panX - WINDOW_W (visible when swiping right) ── */}
      {showPrev && (
        <Animated.View style={{
          position: 'absolute',
          transform: [
            { scale: imageScale },
            { translateX: Animated.add(panX, NEG_W) },
            { translateY: panY },
          ],
          pointerEvents: 'none',
        } as any}>
          <ImageElement src={images[idx - 1]} />
        </Animated.View>
      )}

      {/* ── Current image — at panX ── */}
      <Animated.View style={{
        transform: [
          { scale: imageScale },
          { translateX: panX },
          { translateY: panY },
        ],
      }}>
        <ImageElement src={images[idx]} />
      </Animated.View>

      {/* ── Next image — sits at panX + WINDOW_W (visible when swiping left) ── */}
      {showNext && (
        <Animated.View style={{
          position: 'absolute',
          transform: [
            { scale: imageScale },
            { translateX: Animated.add(panX, POS_W) },
            { translateY: panY },
          ],
          pointerEvents: 'none',
        } as any}>
          <ImageElement src={images[idx + 1]} />
        </Animated.View>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <Text style={styles.counter}>{idx + 1} / {images.length}</Text>
      )}
    </Animated.View>
  );
}

/** Thin wrapper for the native <img> element */
function ImageElement({ src }: { src: string }) {
  return React.createElement('img', {
    src,
    draggable: false as any,
    style: {
      width: '100vw', maxHeight: '90vh', objectFit: 'contain',
      pointerEvents: 'none' as any,
      userSelect: 'none' as any,
    },
    alt: 'preview',
  });
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  close: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowLeft: {
    position: 'absolute', left: 16, top: '50%', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, marginTop: -20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowRight: {
    position: 'absolute', right: 16, top: '50%', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, marginTop: -20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowText: { fontSize: 28, fontWeight: '300', color: '#fff', marginTop: -2 },
  counter: {
    position: 'absolute', bottom: 60, zIndex: 10,
    fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)',
  },
});
