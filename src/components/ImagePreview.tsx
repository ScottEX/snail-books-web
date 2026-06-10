import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ThemeColors, FONTS } from '../theme';

interface ImagePreviewProps {
  /** Image URLs to show */
  images: string[];
  /** Starting index (default 0) */
  initialIdx?: number;
  /** Show/hide the overlay */
  visible: boolean;
  /** Called when user closes the preview */
  onClose: () => void;
}

export default function ImagePreview({
  images,
  initialIdx = 0,
  visible,
  onClose,
}: ImagePreviewProps) {
  const [idx, setIdx] = useState(initialIdx);
  const [opacity, setOpacity] = useState(1);
  const touchStartX = useRef(0);

  const navigate = useCallback((newIdx: number) => {
    setOpacity(0);
    setTimeout(() => {
      setIdx(newIdx);
      setOpacity(1);
    }, 150);
  }, []);

  if (!visible || images.length === 0) return null;

  return (
    <View style={styles.overlay}
      onTouchStart={(e: any) => { touchStartX.current = e.nativeEvent.pageX || e.nativeEvent.touches?.[0]?.pageX || 0; }}
      onTouchEnd={(e: any) => {
        const endX = e.nativeEvent.pageX || e.nativeEvent.changedTouches?.[0]?.pageX || 0;
        const dx = endX - touchStartX.current;
        if (Math.abs(dx) > 60) {
          if (dx < 0 && idx < images.length - 1) {
            navigate(idx + 1);
          } else if (dx > 0 && idx > 0) {
            navigate(idx - 1);
          }
        }
      }}>
      {/* Close button (X) */}
      <TouchableOpacity style={styles.close}
        onPress={onClose}
        activeOpacity={0.7}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>

      {/* Left arrow */}
      {images.length > 1 && idx > 0 && (
        <TouchableOpacity style={styles.arrowLeft}
          onPress={() => navigate(idx - 1)}
          activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
      )}

      {/* Right arrow */}
      {images.length > 1 && idx < images.length - 1 && (
        <TouchableOpacity style={styles.arrowRight}
          onPress={() => navigate(idx + 1)}
          activeOpacity={0.7}>
          <Text style={styles.arrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      )}

      {/* Image */}
      {React.createElement('img', {
        src: images[idx],
        key: idx,
        decoding: 'async' as any,
        style: {
          maxWidth: '90%', maxHeight: '80%', borderRadius: 12, objectFit: 'contain',
          opacity,
          // @ts-ignore
          transition: 'opacity 0.2s ease',
        },
        alt: 'preview',
      })}

      {/* Counter */}
      {images.length > 1 && (
        <Text style={styles.counter}>{idx + 1} / {images.length}</Text>
      )}
    </View>
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
