import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  PanResponder, ScrollView, Image, Platform, useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../theme';

const SPRING = { friction: 8, tension: 60 };
const DISMISS_THRESHOLD = 80;
const DISMISS_VELOCITY = 0.4;
const OPEN_DURATION = 220;
const CLOSE_DURATION = 200;
const SNAP_DURATION = 220;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_ZOOM = 2;

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

  // ── Pinch-zoom guard: suppress overlay PanResponder while zooming ──
  const zoomActiveRef = useRef(false);

  // ── PanResponder — vertical dismiss (disabled during pinch-zoom) ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !dismissing && !zoomActiveRef.current,
    onMoveShouldSetPanResponder: (_, gs) =>
      !dismissing && !zoomActiveRef.current && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5 && Math.abs(gs.dy) > 20,

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
            <ZoomableImage src={src} windowW={WINDOW_W} windowH={WINDOW_H} onZoomActive={(v) => { zoomActiveRef.current = v; }} />
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

/** Zoomable image with pinch-to-zoom (min 1×) and double-tap toggle. Web-only. */
function ZoomableImage({ src, windowW, windowH, onZoomActive }: {
  src: string; windowW: number; windowH: number;
  onZoomActive: (active: boolean) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Ref mirror of scale — read synchronously in touch handlers to avoid stale
  // state closure causing spurious zoom-out on fast pinch release.
  const scaleRef = useRef(1);

  const pinchBase = useRef({ dist: 0, scale: 1 });
  const panBase = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const tapPos = useRef({ x: 0, y: 0 });

  const zoomed = scaleRef.current > 1.01;

  const handleTouchStart = useCallback((e: any) => {
    const ts = e.nativeEvent?.touches || e.touches || [];
    const isPinch = ts.length === 2;
    const isPan = ts.length === 1 && zoomed;

    if (!isPinch && !isPan) return; // let event bubble to parent for dismiss/swipe

    e.stopPropagation();
    onZoomActive(true); // suppress overlay PanResponder during zoom/pan
    if (isPinch) {
      const dx = ts[0].clientX - ts[1].clientX;
      const dy = ts[0].clientY - ts[1].clientY;
      pinchBase.current = { dist: Math.hypot(dx, dy), scale: scaleRef.current };
    } else {
      panBase.current = { x: offset.x, y: offset.y };
    }
  }, [offset, zoomed, onZoomActive]);

  const handleTouchMove = useCallback((e: any) => {
    const ts = e.nativeEvent?.touches || e.touches || [];
    const isPinch = ts.length === 2;
    const isPan = ts.length === 1 && zoomed;

    if (!isPinch && !isPan) return; // let parent handle scrolling/swiping

    e.stopPropagation();
    e.preventDefault?.();

    if (isPinch) {
      const dx = ts[0].clientX - ts[1].clientX;
      const dy = ts[0].clientY - ts[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchBase.current.dist > 0) {
        const newScale = Math.max(1, Math.min(MAX_ZOOM, pinchBase.current.scale * (dist / pinchBase.current.dist)));
        scaleRef.current = newScale;
        setScale(newScale);
      }
    } else {
      const touch = ts[0];
      setOffset({
        x: panBase.current.x + (touch.clientX - touchRef.current.startX),
        y: panBase.current.y + (touch.clientY - touchRef.current.startY),
      });
    }
  }, [zoomed]);

  const handleTouchEnd = useCallback((e: any) => {
    const ts = e.nativeEvent?.changedTouches || e.changedTouches || [];
    const isPinch = ts.length === 2;
    const curScale = scaleRef.current;
    const curZoomed = curScale > 1.01;

    // Only block propagation if we're handling our own gesture
    if (curZoomed || isPinch) {
      e.stopPropagation();
    } else {
      return; // let parent handle (dismiss)
    }

    const now = Date.now();

    // Double-tap detection
    if (ts.length === 1 && now - lastTap.current < DOUBLE_TAP_MS) {
      const touch = ts[0];
      if (curZoomed) {
        // Zoom out
        scaleRef.current = 1;
        setScale(1);
        setOffset({ x: 0, y: 0 });
        onZoomActive(false);
      } else {
        // Zoom in to 2× centered on tap
        scaleRef.current = DOUBLE_TAP_ZOOM;
        setScale(DOUBLE_TAP_ZOOM);
        const cx = windowW / 2;
        const cy = windowH / 2;
        const newOx = (cx - touch.clientX) * (DOUBLE_TAP_ZOOM - 1);
        const newOy = (cy - touch.clientY) * (DOUBLE_TAP_ZOOM - 1);
        setOffset({ x: newOx, y: newOy });
      }
      lastTap.current = 0;
      return;
    }

    if (ts.length === 1) {
      lastTap.current = now;
      tapPos.current = { x: ts[0].clientX, y: ts[0].clientY };
    }

    // Clamp pan on release: don't let image drift too far offscreen
    if (curScale <= 1.01) {
      scaleRef.current = 1;
      setScale(1);
      setOffset({ x: 0, y: 0 });
      onZoomActive(false);
    }
  }, [windowW, windowH, onZoomActive]);

  // Track single-touch reference point for panning
  const touchRef = useRef({ startX: 0, startY: 0 });

  const onTouchStartFull = useCallback((e: any) => {
    const ts = e.nativeEvent.touches || e.touches || [];
    if (ts.length === 1 && zoomed) {
      touchRef.current = { startX: ts[0].clientX, startY: ts[0].clientY };
    }
    handleTouchStart(e);
  }, [zoomed, handleTouchStart]);

  const onTouchMoveFull = useCallback((e: any) => {
    const ts = e.nativeEvent.touches || e.touches || [];
    if (ts.length === 1 && zoomed) {
      const dx = ts[0].clientX - touchRef.current.startX;
      const dy = ts[0].clientY - touchRef.current.startY;
      setOffset({ x: panBase.current.x + dx, y: panBase.current.y + dy });
    } else if (ts.length === 2) {
      handleTouchMove(e);
    }
  }, [zoomed, handleTouchMove]);

  // Only render interactive wrapper on web
  if (Platform.OS !== 'web') {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
      />
    );
  }

  // Web-only: raw div for touch event fidelity
  return React.createElement('div', {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      touchAction: zoomed ? 'none' : 'auto',
    } as React.CSSProperties,
    onTouchStart: onTouchStartFull,
    onTouchMove: onTouchMoveFull,
    onTouchEnd: handleTouchEnd,
  },
    React.createElement('img', {
      src,
      draggable: false,
      alt: 'preview',
      style: {
        width: `${100 * scale}%`,
        maxWidth: 'none',
        height: 'auto',
        maxHeight: `${90 * scale}vh`,
        objectFit: 'contain',
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center center',
        transition: scale === 1 && offset.x === 0 && offset.y === 0
          ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        pointerEvents: 'none',
      } as React.CSSProperties,
    })
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
