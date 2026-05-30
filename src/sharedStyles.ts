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
