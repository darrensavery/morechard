import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tick } from '../lib/haptics';

// iOS-style deceleration curve — fast start, gentle settle, no overshoot.
const CLOSE_DURATION_MS = 300;
const SHEET_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SHEET_TRANSITION = `transform ${CLOSE_DURATION_MS}ms ${SHEET_EASING}`;

/**
 * Returns refs, event handlers and ready-to-spread styles to wire up a bottom
 * sheet's full open/close lifecycle: slides up on mount, follows the finger
 * while dragging the handle, and springs open or continues its momentum shut
 * (>120px drag) with the same easing as the slide-in — instead of a flat
 * instant show/hide. `onClose` fires once the closing animation finishes, so
 * callers can safely unmount right away.
 */
export function useDragToClose(onClose: () => void) {
  const sheetRef    = useRef<HTMLDivElement>(null);
  const dragStartY  = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>('entering');

  // Flip to 'open' a frame after mount so the initial 'entering' (off-screen)
  // style is actually painted first, giving the panel something to slide from.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase(p => (p === 'entering' ? 'open' : p)));
    return () => cancelAnimationFrame(raf);
  }, []);

  function close() {
    void tick();
    setPhase('closing');
  }

  useEffect(() => {
    if (phase !== 'closing') return;
    const timeout = setTimeout(onClose, CLOSE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [phase, onClose]);

  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    dragOffsetY.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }

  function onDragMove(clientY: number) {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, clientY - dragStartY.current);
    dragOffsetY.current = delta;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`;
  }

  function onDragEnd() {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    // Re-prime the inline transition (cleared to 'none' on drag start) so
    // whichever way we're about to animate — continuing shut on momentum,
    // or springing back open — plays with the same eased curve.
    if (sheetRef.current) sheetRef.current.style.transition = SHEET_TRANSITION;
    if (dragOffsetY.current > 120) {
      close();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  }

  const handleProps = {
    className: 'flex justify-center items-center py-4 shrink-0 cursor-grab active:cursor-grabbing touch-none',
    onMouseDown: (e: React.MouseEvent) => onDragStart(e.clientY),
    onMouseMove: (e: React.MouseEvent) => { if (dragStartY.current !== null) onDragMove(e.clientY); },
    onMouseUp: onDragEnd,
    onMouseLeave: onDragEnd,
    onTouchStart: (e: React.TouchEvent) => onDragStart(e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => onDragMove(e.touches[0].clientY),
    onTouchEnd: onDragEnd,
  };

  const isOpen = phase === 'open';
  const panelStyle: CSSProperties = {
    transform: `translateY(${isOpen ? '0' : '100%'})`,
    transition: SHEET_TRANSITION,
  };
  const backdropStyle: CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transition: `opacity ${CLOSE_DURATION_MS}ms ease-out`,
  };

  return { sheetRef, handleProps, close, phase, isOpen, panelStyle, backdropStyle };
}
