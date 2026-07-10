import { useEffect, useRef, RefObject, MutableRefObject } from 'react';

/** Shared crop state shape used by all Canvas cropping components.
 *  Individual components may extend this with their own fields. */
interface CropStateCommon {
  x: number; y: number; scale: number; minScale: number; maxScale: number;
  drag: { active: boolean; sx: number; sy: number; ox: number; oy: number };
  pinch: { active: boolean; startDist: number; startScale: number; midX: number; midY: number };
}

interface UseCropCanvasOptions {
  /** Only bind events when true (e.g. when crop UI is visible). */
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  guideRef: RefObject<HTMLDivElement | null>;
  stateRef: MutableRefObject<CropStateCommon>;
  scheduleDraw: () => void;
  clampCrop: () => void;
  zoomCrop: (delta: number, px: number, py: number) => void;
  onZoomChange?: () => void;        // called after scale changes (wheel/pinch)
  onSetup: () => void;               // called on mount and resize
  onGuideActiveChange?: (active: boolean) => void;
  onBeforeDrag?: () => void;         // e.g. hidePill() in ProfileScreen
}

/** Bind mouse, touch, wheel, and resize events for canvas-based image
 *  cropping. Extracted from 4 duplicate implementations across
 *  BgCropModal, ProfileScreen (avatar + cover), and PartnerScreen.
 *
 *  When active becomes true, polls with requestAnimationFrame until
 *  stage + canvas refs are populated (FullscreenOverlay renders via
 *  createPortal and needs two React passes). Once ready, binds all
 *  event listeners and fires the initial setup. */
export function useCropCanvas(opts: UseCropCanvasOptions) {
  const {
    active,
    canvasRef,
    stageRef,
    guideRef,
    stateRef,
    scheduleDraw,
    clampCrop,
    zoomCrop,
    onZoomChange,
    onSetup,
    onGuideActiveChange,
    onBeforeDrag,
  } = opts;

  // Refs to hold the callbacks so the effect can depend only on 'active'
  const callbacks = useRef({ scheduleDraw, clampCrop, zoomCrop, onZoomChange, onSetup, onGuideActiveChange, onBeforeDrag });
  callbacks.current = { scheduleDraw, clampCrop, zoomCrop, onZoomChange, onSetup, onGuideActiveChange, onBeforeDrag };

  useEffect(() => {
    if (!active) return;

    let attempts = 0;
    let rafId = 0;
    let frameId = 0;
    let setupTimer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    // Event handler refs (populated once DOM is ready)
    let onMD: ((e: MouseEvent) => void) | undefined;
    let onMM: ((e: MouseEvent) => void) | undefined;
    let onMU: (() => void) | undefined;
    let onWheel: ((e: WheelEvent) => void) | undefined;
    let onTS: ((e: TouchEvent) => void) | undefined;
    let onTM: ((e: TouchEvent) => void) | undefined;
    let onTE: ((e: TouchEvent) => void) | undefined;
    let onResize: (() => void) | undefined;

    const tryInit = () => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        if (attempts++ < 30) {
          rafId = requestAnimationFrame(tryInit);
        }
        return;
      }

      const { scheduleDraw: sched, clampCrop: clamp, zoomCrop: zoom, onZoomChange: zoomChanged, onSetup: setup, onGuideActiveChange: guideChange, onBeforeDrag: beforeDrag } = callbacks.current;

      // Initial setup (60ms delay to let layout settle)
      setupTimer = setTimeout(() => { if (mounted) { setup(); clamp(); sched(); } }, 60);

      const rafDraw = () => {
        if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; sched(); });
      };

      const toLocal = (clientX: number, clientY: number) => {
        const r = stage.getBoundingClientRect();
        return { x: clientX - r.left - canvas.width / 2, y: clientY - r.top - canvas.height / 2 };
      };

      const setGuideActive = (v: boolean) => {
        const g = guideRef.current;
        if (!g) return;
        g.style.borderColor = v ? '#fff' : 'rgba(255,255,255,0.8)';
        g.style.boxShadow = v
          ? '0 0 0 9999px rgba(0,0,0,0.62)'
          : '0 0 0 9999px rgba(0,0,0,0.55)';
        guideChange?.(v);
      };

      // ── Mouse ──
      onMD = (e: MouseEvent) => {
        beforeDrag?.();
        const s = stateRef.current; s.drag.active = true;
        s.drag.sx = e.clientX; s.drag.sy = e.clientY;
        s.drag.ox = s.x; s.drag.oy = s.y;
        setGuideActive(true);
      };
      onMM = (e: MouseEvent) => {
        const s = stateRef.current; if (!s.drag.active) return;
        s.x = s.drag.ox + (e.clientX - s.drag.sx);
        s.y = s.drag.oy + (e.clientY - s.drag.sy);
        clamp(); rafDraw();
      };
      onMU = () => {
        stateRef.current.drag.active = false;
        setGuideActive(false);
      };

      // ── Wheel zoom ──
      onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const p = toLocal(e.clientX, e.clientY);
        zoom(e.deltaY > 0 ? -0.08 : 0.08, p.x, p.y);
        zoomChanged?.();
      };

      // ── Touch ──
      const getDist = (ts: TouchList) =>
        Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);

      onTS = (e: TouchEvent) => {
        e.preventDefault();
        const s = stateRef.current;
        if (e.touches.length === 1) {
          beforeDrag?.();
          s.drag.active = true;
          s.drag.sx = e.touches[0].clientX; s.drag.sy = e.touches[0].clientY;
          s.drag.ox = s.x; s.drag.oy = s.y;
          setGuideActive(true);
        } else if (e.touches.length === 2) {
          s.drag.active = false; setGuideActive(false);
          s.pinch.active = true;
          s.pinch.startDist = getDist(e.touches);
          s.pinch.startScale = s.scale;
          const r = stage.getBoundingClientRect();
          s.pinch.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left - canvas.width / 2;
          s.pinch.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top - canvas.height / 2;
        }
      };
      onTM = (e: TouchEvent) => {
        e.preventDefault();
        const s = stateRef.current;
        if (s.drag.active && e.touches.length === 1) {
          s.x = s.drag.ox + (e.touches[0].clientX - s.drag.sx);
          s.y = s.drag.oy + (e.touches[0].clientY - s.drag.sy);
          clamp(); rafDraw();
        } else if (s.pinch.active && e.touches.length === 2) {
          const d = getDist(e.touches);
          const ns = Math.max(s.minScale, Math.min(s.maxScale, s.pinch.startScale * (d / s.pinch.startDist)));
          const sd = ns / s.scale;
          s.x = s.pinch.midX + (s.x - s.pinch.midX) * sd;
          s.y = s.pinch.midY + (s.y - s.pinch.midY) * sd;
          s.scale = ns; clamp(); rafDraw();
          zoomChanged?.();
        }
      };
      onTE = (e: TouchEvent) => {
        const s = stateRef.current;
        if (e.touches.length < 2) s.pinch.active = false;
        if (e.touches.length === 0) { s.drag.active = false; setGuideActive(false); }
      };

      onResize = () => { setup(); clamp(); sched(); };
      window.addEventListener('resize', onResize);

      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mousemove', onMM);
      window.addEventListener('mouseup', onMU);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchstart', onTS, { passive: false });
      canvas.addEventListener('touchmove', onTM, { passive: false });
      canvas.addEventListener('touchend', onTE);
      canvas.addEventListener('touchcancel', onTE);
    };

    rafId = requestAnimationFrame(tryInit);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(frameId);
      if (setupTimer) clearTimeout(setupTimer);
      const canvas = canvasRef.current;
      if (canvas) {
        if (onMD) canvas.removeEventListener('mousedown', onMD);
        if (onMM) window.removeEventListener('mousemove', onMM);
        if (onMU) window.removeEventListener('mouseup', onMU);
        if (onWheel) canvas.removeEventListener('wheel', onWheel);
        if (onTS) canvas.removeEventListener('touchstart', onTS);
        if (onTM) canvas.removeEventListener('touchmove', onTM);
        if (onTE) {
          canvas.removeEventListener('touchend', onTE);
          canvas.removeEventListener('touchcancel', onTE);
        }
      }
      if (onResize) window.removeEventListener('resize', onResize);
    };
  }, [active]);
}
