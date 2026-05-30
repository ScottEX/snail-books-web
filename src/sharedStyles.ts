// ═══════════════════════════════════════════
// Shared StyleSheet constants for snail-books
// Import these instead of copying animation/sizing properties per-screen.
// ═══════════════════════════════════════════

/** Modal card enter animation (scale+fade). Include via spread in modalCard StyleSheet. */
export const modalCardAnimation = {
  // @ts-ignore — CSS animation properties not typed in RN StyleSheet
  animationName: 'modalIn',
  animationDuration: '0.2s',
  animationTimingFunction: 'ease',
};

/** Modal close button (✕) — white at 70% opacity, light weight. Used on dark primary headers. */
export const modalClose = {
  fontSize: 18,
  color: 'rgba(255,255,255,0.7)',
  fontWeight: '300' as const,
};
