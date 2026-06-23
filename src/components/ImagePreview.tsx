import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../theme';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');

const DISMISS_THRESHOLD = 100;   // px — pull down this far triggers dismiss
const SWIPE_THRESHOLD = 80;       // px — horizontal swipe to switch
const OPEN_DURATION = 200;
const CLOSE_DURATION = 200;

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
  const [idx, setIdx] = useState(initialIdx);
  const [dismissing, setDismissing] = useState(false);

  // ── Animated values ──
  const overlayOpacity = useRef(new Animated.Value(0)).current;   // 0→1 open, 1→0 close
  const imageScale = useRef(new Animated.Value(0.92)).current;     // 0.92→1 open, 1→0.92 close
  const panX = useRef(new Animated.Value(0)).current;              // horizontal drag offset
  const panY = useRef(new Animated.Value(0)).current;              // vertical drag offset
  const imageOpacity = useRef(new Animated.Value(1)).current;      // switch crossfade

  // ── Gesture tracking refs ──
  const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const gestureDX = useRef(0);
  const gestureDY = useRef(0);

  // ── ① Mount: fade in + scale up ──
  useEffect(() => {
    overlayOpacity.setValue(0);
    imageScale.setValue(0.92);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Close with reverse animation ──
  const animateClose = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { toValue: 0.92, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [dismissing, overlayOpacity, imageScale, onClose]);

  // ── ④ Horizontal slide-switch ──
  const switchTo = useCallback((newIdx: number, slideDir: 'left' | 'right') => {
    // Animate current image fully off-screen
    const exitTarget = slideDir === 'left' ? -WINDOW_W : WINDOW_W;
    Animated.parallel([
      Animated.timing(imageOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(panX, { toValue: exitTarget, duration: 150, useNativeDriver: false }),
    ]).start(() => {
      // Jump to new image, positioned off-screen from opposite side
      setIdx(newIdx);
      panX.setValue(-exitTarget);   // enter from opposite side
      // Slide in + fade in
      Animated.parallel([
        Animated.timing(imageOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(panX, { toValue: 0, friction: 7, tension: 80, useNativeDriver: false }),
      ]).start();
    });
  }, [imageOpacity, panX]);

  // ── ② / ④ PanResponder (pull-down dismiss + horizontal switch) ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !dismissing,
    onMoveShouldSetPanResponder: (_, gs) =>
      !dismissing && (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8),

    onPanResponderGrant: () => {
      gestureType.current = 'none';
      gestureDX.current = 0;
      gestureDY.current = 0;
    },

    onPanResponderMove: (_, gs) => {
      gestureDX.current = gs.dx;
      gestureDY.current = gs.dy;

      // Determine gesture direction on first significant move
      if (gestureType.current === 'none') {
        if (Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10) {
          gestureType.current = 'horizontal';
        } else if (Math.abs(gs.dy) > 10) {
          gestureType.current = 'vertical';
        }
      }

      if (gestureType.current === 'horizontal') {
        // Only allow horizontal swipe when there are adjacent images
        const blockedLeft = gs.dx > 0 && idx === 0;
        const blockedRight = gs.dx < 0 && idx === images.length - 1;
        if (blockedLeft || blockedRight) {
          // Rubber-band effect: reduce movement at edges
          panX.setValue(gs.dx * 0.3);
        } else {
          panX.setValue(gs.dx);
        }
        // Slight fade as we drag
        const fade = Math.max(0.6, 1 - Math.abs(gs.dx) / 300);
        imageOpacity.setValue(fade);
      } else if (gestureType.current === 'vertical') {
        panY.setValue(gs.dy);
        // Reduce overlay opacity proportional to drag distance
        const progress = Math.min(Math.abs(gs.dy) / DISMISS_THRESHOLD, 1);
        overlayOpacity.setValue(1 - progress * 0.6);
      }
    },

    onPanResponderRelease: (_, gs) => {
      if (gestureType.current === 'horizontal') {
        const blockedLeft = gs.dx > 0 && idx === 0;
        const blockedRight = gs.dx < 0 && idx === images.length - 1;

        if (!blockedLeft && !blockedRight && Math.abs(gs.dx) > SWIPE_THRESHOLD) {
          // Switch image
          const newIdx = gs.dx > 0 ? idx - 1 : idx + 1;
          const dir = gs.dx > 0 ? 'right' : 'left';
          switchTo(newIdx, dir);
        } else {
          // Spring back
          Animated.parallel([
            Animated.spring(panX, { toValue: 0, friction: 7, tension: 80, useNativeDriver: false }),
            Animated.timing(imageOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      } else if (gestureType.current === 'vertical') {
        if (gs.dy > DISMISS_THRESHOLD || (gs.vy > 0.5 && gs.dy > 40)) {
          // Dismiss — animate off screen
          setDismissing(true);
          Animated.parallel([
            Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
            Animated.timing(panY, { toValue: WINDOW_H, duration: CLOSE_DURATION, useNativeDriver: false }),
          ]).start(() => onClose());
        } else {
          // Spring back to center
          Animated.parallel([
            Animated.spring(panY, { toValue: 0, friction: 7, tension: 80, useNativeDriver: false }),
            Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      }

      // Reset gesture tracking
      gestureType.current = 'none';
    },
  }), [idx, images.length, dismissing, switchTo, panX, panY, overlayOpacity, imageOpacity, onClose]);

  if (!visible || images.length === 0) return null;

  const prevEnabled = images.length > 1 && idx > 0;
  const nextEnabled = images.length > 1 && idx < images.length - 1;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} {...panResponder.panHandlers}>
      {/* Close button */}
      <TouchableOpacity style={styles.close} onPress={animateClose} activeOpacity={0.7}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>

      {/* Left arrow */}
      {prevEnabled && (
        <TouchableOpacity style={styles.arrowLeft} onPress={() => switchTo(idx - 1, 'right')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
      )}

      {/* Right arrow */}
      {nextEnabled && (
        <TouchableOpacity style={styles.arrowRight} onPress={() => switchTo(idx + 1, 'left')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      )}

      {/* Image — scale + pan + fade */}
      <Animated.View style={{
        transform: [
          { scale: imageScale },
          { translateX: panX },
          { translateY: panY },
        ],
      }}>
        <Animated.View style={{ opacity: imageOpacity }}>
          {React.createElement('img', {
            src: images[idx],
            key: idx,
            draggable: false as any,
            style: {
              maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain',
              pointerEvents: 'none' as any,
            },
            alt: 'preview',
          })}
        </Animated.View>
      </Animated.View>

      {/* Counter */}
      {images.length > 1 && (
        <Text style={styles.counter}>{idx + 1} / {images.length}</Text>
      )}
    </Animated.View>
  );
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
