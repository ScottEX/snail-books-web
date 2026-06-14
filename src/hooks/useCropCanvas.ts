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
  onSetup: () => void;               // called on mount and resize
  onGuideActiveChange?: (active: boolean) => void;
  onBeforeDrag?: () => void;         // e.g. hidePill() in ProfileScreen
}

/** Bind mouse, touch, wheel, and resize events for canvas-based image
 *  cropping. Extracted from 4 duplicate implementations across
 *  BgCropModal, ProfileScreen (avatar + cover), and PartnerScreen.
 *
 *  Usage:
 *    useCropCanvas({
 *      active: phase === 'cropping',
 *      canvasRef, stageRef, guideRef, stateRef,
 *      scheduleDraw, clampCrop, zoomCrop, onSetup,
 *      onGuideActiveChange: setGuideActive,
 *    });
 */
export function useCropCanvas(opts: UseCropCanvasOptions) {
  const {
    active, canvasRef, stageRef, guideRef, stateRef,
    scheduleDraw, clampCrop, zoomCrop, onSetup,
    onGuideActiveChange, onBeforeDrag,
  } = opts;

  // Refs to hold the callbacks so the effect can depend only on 'active'
  const callbacks = useRef({ scheduleDraw, clampCrop, zoomCrop, onSetup, onGuideActiveChange, onBeforeDrag });
  callbacks.current = { scheduleDraw, clampCrop, zoomCrop, onSetup, onGuideActiveChange, onBeforeDrag };

  useEffect(() => {
    if (!active) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const { scheduleDraw: sched, clampCrop: clamp, zoomCrop: zoom, onSetup: setup, onGuideActiveChange: guideChange, onBeforeDrag: beforeDrag } = callbacks.current;

    setTimeout(() => { setup(); clamp(); sched(); }, 60);

    let frameId = 0;
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
    const onMD = (e: MouseEvent) => {
      beforeDrag?.();
      const s = stateRef.current; s.drag.active = true;
      s.drag.sx = e.clientX; s.drag.sy = e.clientY;
      s.drag.ox = s.x; s.drag.oy = s.y;
      setGuideActive(true);
    };
    const onMM = (e: MouseEvent) => {
      const s = stateRef.current; if (!s.drag.active) return;
      s.x = s.drag.ox + (e.clientX - s.drag.sx);
      s.y = s.drag.oy + (e.clientY - s.drag.sy);
      clamp(); rafDraw();
    };
    const onMU = () => {
      stateRef.current.drag.active = false;
      setGuideActive(false);
    };

    // ── Wheel zoom ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      zoom(e.deltaY > 0 ? -0.08 : 0.08, p.x, p.y);
    };

    // ── Touch ──
    const getDist = (ts: TouchList) =>
      Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);

    const onTS = (e: TouchEvent) => {
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
    const onTM = (e: TouchEvent) => {
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
      }
    };
    const onTE = (e: TouchEvent) => {
      const s = stateRef.current;
      if (e.touches.length < 2) s.pinch.active = false;
      if (e.touches.length === 0) { s.drag.active = false; setGuideActive(false); }
    };

    const onResize = () => { setup(); clamp(); sched(); };
    window.addEventListener('resize', onResize);

    canvas.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE);
    canvas.addEventListener('touchcancel', onTE);

    return () => {
      canvas.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTS);
      canvas.removeEventListener('touchmove', onTM);
      canvas.removeEventListener('touchend', onTE);
      canvas.removeEventListener('touchcancel', onTE);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
    };
  }, [active]);
}
