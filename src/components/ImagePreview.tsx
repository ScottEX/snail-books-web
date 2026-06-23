import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../theme';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');

const DISMISS_THRESHOLD = 80;    // px
const DISMISS_VELOCITY = 0.4;    // fling velocity threshold
const SWIPE_THRESHOLD = 60;      // px
const SWIPE_VELOCITY = 0.3;      // fling velocity threshold
const OPEN_DURATION = 220;
const CLOSE_DURATION = 200;
const SWITCH_DURATION = 280;

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
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.92)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(1)).current;

  // ── Transition state (for smooth horizontal switch) ──
  // When set, both current (idx) and new image render simultaneously
  const [transition, setTransition] = useState<{ newIdx: number; dir: 'left' | 'right' } | null>(null);

  // ── Gesture refs ──
  const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');

  // ── ① Mount: fade + scale ──
  useEffect(() => {
    overlayOpacity.setValue(0);
    imageScale.setValue(0.92);
    imageOpacity.setValue(1);
    panX.setValue(0);
    panY.setValue(0);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Close with reverse animation ──
  const animateClose = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
      Animated.spring(imageScale, { toValue: 0.92, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [dismissing, overlayOpacity, imageScale, onClose]);

  // ── ④ Horizontal slide-switch (smooth — both images visible during transition) ──
  const switchTo = useCallback((newIdx: number, dir: 'left' | 'right') => {
    const exitTarget = dir === 'left' ? -WINDOW_W : WINDOW_W;

    // Phase 1: current slides out + new slides in simultaneously
    setTransition({ newIdx, dir });
    Animated.parallel([
      Animated.timing(panX, { toValue: exitTarget, duration: SWITCH_DURATION, useNativeDriver: false }),
    ]).start(() => {
      // Phase 2: commit — set new index, reset position
      setIdx(newIdx);
      setTransition(null);
      panX.setValue(0);
      imageOpacity.setValue(1);
    });
  }, [panX, imageOpacity]);

  // ── PanResponder ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !dismissing && !transition,
    onMoveShouldSetPanResponder: (_, gs) =>
      !dismissing && !transition && (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6),

    onPanResponderGrant: () => {
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
          panX.setValue(gs.dx * 0.25);  // strong rubber-band at edges
        } else {
          panX.setValue(gs.dx);
        }
        // Subtle fade as drag increases
        imageOpacity.setValue(Math.max(0.5, 1 - Math.abs(gs.dx) / 400));
      } else if (gestureType.current === 'vertical') {
        const dy = gs.dy;
        panY.setValue(dy);
        // Image shrinks slightly as you pull down (0→1% per px, max 5% shrink)
        const shrink = Math.min(Math.abs(dy) / 2000, 0.05);
        imageScale.setValue(1 - shrink);
        // Overlay fades proportional to drag
        const progress = Math.min(Math.abs(dy) / (DISMISS_THRESHOLD * 1.5), 1);
        overlayOpacity.setValue(1 - progress * 0.55);
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
          // Spring back — softer, bouncier
          Animated.parallel([
            Animated.spring(panX, { toValue: 0, friction: 8, tension: 50, useNativeDriver: false }),
            Animated.timing(imageOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]).start();
        }
      } else if (gestureType.current === 'vertical') {
        const fastFling = gs.vy > DISMISS_VELOCITY;
        const overThreshold = gs.dy > DISMISS_THRESHOLD;

        if (overThreshold || (fastFling && gs.dy > 30)) {
          // Dismiss — fly off screen + scale down
          setDismissing(true);
          Animated.parallel([
            Animated.timing(overlayOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
            Animated.timing(panY, { toValue: WINDOW_H * 0.6, duration: CLOSE_DURATION, useNativeDriver: false }),
            Animated.timing(imageScale, { toValue: 0.85, duration: CLOSE_DURATION, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          // Spring back — scale recovers, overlay recovers
          Animated.parallel([
            Animated.spring(panY, { toValue: 0, friction: 8, tension: 50, useNativeDriver: false }),
            Animated.spring(imageScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]).start();
        }
      }

      gestureType.current = 'none';
    },
  }), [idx, images.length, dismissing, transition, switchTo,
       panX, panY, overlayOpacity, imageScale, imageOpacity, onClose]);

  if (!visible || images.length === 0) return null;

  const prevEnabled = images.length > 1 && idx > 0;
  const nextEnabled = images.length > 1 && idx < images.length - 1;

  // ── During horizontal transition, render both current + new image ──
  const showBoth = transition !== null;
  const exitDir = transition?.dir;
  const exitIdx = showBoth ? idx : -1;
  const enterIdx = showBoth ? transition!.newIdx : -1;
  // New image slides in from the opposite side
  const enterStart = exitDir === 'left' ? WINDOW_W : -WINDOW_W;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} {...panResponder.panHandlers}>
      {/* Close button */}
      <TouchableOpacity style={styles.close} onPress={animateClose} activeOpacity={0.7}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>

      {/* Left arrow */}
      {prevEnabled && !showBoth && (
        <TouchableOpacity style={styles.arrowLeft} onPress={() => switchTo(idx - 1, 'right')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
      )}

      {/* Right arrow */}
      {nextEnabled && !showBoth && (
        <TouchableOpacity style={styles.arrowRight} onPress={() => switchTo(idx + 1, 'left')} activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      )}

      {/* ── Image area ── */}
      {showBoth ? (
        <>
          {/* Exiting image — follows panX (0 → exitTarget) */}
          <Animated.View style={{
            position: 'absolute',
            transform: [
              { scale: imageScale },
              { translateX: panX },
              { translateY: panY },
            ],
            opacity: Animated.subtract(new Animated.Value(1), Animated.multiply(
              Animated.divide(panX, exitDir === 'left' ? -WINDOW_W : WINDOW_W), new Animated.Value(1)
            )),
          } as any}>
            <ImageElement src={images[exitIdx]} />
          </Animated.View>

          {/* Entering image — slides in from opposite side: enterStart + panX → 0 */}
          <Animated.View style={{
            position: 'absolute',
            transform: [
              { scale: imageScale },
              { translateX: Animated.add(new Animated.Value(enterStart), panX) },
              { translateY: panY },
            ],
            opacity: Animated.divide(panX, exitDir === 'left' ? -WINDOW_W : WINDOW_W),
          } as any}>
            <ImageElement src={images[enterIdx]} />
          </Animated.View>
        </>
      ) : (
        <Animated.View style={{
          transform: [
            { scale: imageScale },
            { translateX: panX },
            { translateY: panY },
          ],
          opacity: imageOpacity,
        }}>
          <ImageElement src={images[idx]} />
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
      maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain',
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
