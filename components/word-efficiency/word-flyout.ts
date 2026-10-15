"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

// Font/color/underline flyouts were each positioned with a hardcoded
// guess at their own rendered width (e.g. "window.innerWidth-158" for a
// palette that's actually ~132px wide) to clamp them onto the screen.
// Reported live: on a narrow viewport the guess and the real size didn't
// agree, so the clamp let the palette sit past the right edge -- mostly
// off-screen, just a sliver of color swatches visible, the rest
// unreachable. A hardcoded guess can never really track "how wide is
// this popup", since that depends on the option list, font names, and
// the viewport's own font rendering. This measures the actual portaled
// element after it mounts (first effect: initial guess near the trigger
// so there's something to measure; second effect, no dependency array so
// it re-checks every render while open: nudge it back inside the
// viewport if the real box overflows) instead of asserting a size.
export function useClampedFlyoutPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>, align: "left" | "right" = "left") {
  const [position, setPosition] = useState<CSSProperties>({});
  const flyoutRef = useRef<HTMLDivElement>(null);
  // Place the flyout under its trigger, and re-place it if the page scrolls or resizes
  // while it is open (the flyout is position:fixed, so it would otherwise stay behind).
  useLayoutEffect(() => {
    if (!open) { setPosition({}); return; }
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ position: "fixed", left: align === "left" ? rect.left : undefined, right: align === "right" ? Math.max(4, window.innerWidth - rect.right) : undefined, top: rect.bottom + 2 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, align, anchorRef]);
  // Only clamp once the flyout has actually been positioned under its trigger. Measuring it
  // before that (while it still sits unpositioned at the top-left of the page) used to
  // "clamp" it to the top-left corner of the screen instead of under the control.
  useLayoutEffect(() => {
    if (!open || position.position !== "fixed") return;
    const flyout = flyoutRef.current;
    if (!flyout) return;
    const rect = flyout.getBoundingClientRect();
    const margin = 4;
    let left = rect.left, top = rect.top;
    if (rect.right > window.innerWidth - margin) left -= rect.right - (window.innerWidth - margin);
    if (left < margin) left = margin;
    if (rect.bottom > window.innerHeight - margin) top -= rect.bottom - (window.innerHeight - margin);
    if (top < margin) top = margin;
    if (Math.abs(left - rect.left) > 0.5 || Math.abs(top - rect.top) > 0.5) setPosition(current => ({ ...current, left, top, right: "auto" }));
  });
  return { position, flyoutRef };
}

// Close an open flyout when the user clicks anywhere outside it (and its trigger) or presses
// Escape. Without this, galleries stayed open on screen until their trigger was clicked again.
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => { const target = event.target as Node; if (refs.some(ref => ref.current?.contains(target))) return; closeRef.current(); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down, true); document.removeEventListener("keydown", key); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable ref objects
}
