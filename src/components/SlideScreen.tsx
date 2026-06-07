import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: (close: () => void) => React.ReactNode;
  top?: number;
  /** Position in page stack — used for zIndex layering */
  stackIndex?: number;
  /** True for topmost page — pointer-events: none when false */
  isTop?: boolean;
  /** Optional background color. Omit for transparent (frosted glass). */
  backgroundColor?: string;
}

/* ── CSS injected once into <head> — same keyframes as PDF preview ── */
const SS_CSS = `
@keyframes ss-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes ss-slide-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
.ss-root{
  position:absolute;top:0;left:0;right:0;bottom:0;
  transform:translateX(0);
}
.ss-root.ss-enter{animation:ss-slide-in 280ms cubic-bezier(0.215,0.61,0.355,1) both}
.ss-root.ss-exit{animation:ss-slide-out 250ms cubic-bezier(0.55,0.055,0.675,0.19) both}
`;

let ssInjected = false;

type Phase = 'enter' | 'idle' | 'exit' | 'hidden';

export default function SlideScreen({
  visible, onClose, children,
  top = 0, stackIndex = 0, isTop = true,
  backgroundColor,
}: Props) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const zIndex = 100 + stackIndex * 10;

  // Inject the shared CSS once
  useEffect(() => {
    if (ssInjected) return;
    ssInjected = true;
    const s = document.createElement('style');
    s.textContent = SS_CSS;
    document.head.appendChild(s);
  }, []);

  // ── visible → enter / !visible → exit ──
  useEffect(() => {
    if (visible) {
      setPhase('enter');
      timer.current = setTimeout(() => setPhase(p => (p === 'enter' ? 'idle' : p)), 280);
      return () => clearTimeout(timer.current);
    }
    if (phase === 'enter' || phase === 'idle') {
      setPhase('exit');
      timer.current = setTimeout(() => {
        setPhase('hidden');
        onClose();
      }, 250);
      return () => clearTimeout(timer.current);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    if (phase === 'exit' || phase === 'hidden') return;
    setPhase('exit');
    timer.current = setTimeout(() => {
      setPhase('hidden');
      onClose();
    }, 250);
  }, [phase, onClose]);

  // Don't render anything when fully hidden
  if (phase === 'hidden') return null;

  const cls = `ss-root${phase === 'enter' ? ' ss-enter' : ''}${phase === 'exit' ? ' ss-exit' : ''}`;

  return (
    <div
      className={cls}
      style={{
        top,
        zIndex,
        backgroundColor: backgroundColor || 'transparent',
        pointerEvents: isTop ? 'auto' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children(close)}
    </div>
  );
}
