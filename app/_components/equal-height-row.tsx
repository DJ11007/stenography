"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Real reported bug: CSS Grid's default "stretch" alignment only applies
// AFTER the grid computes its auto-sized row track height from each
// item's own content-based intrinsic size -- a flex-1/overflow-auto
// child (the success-story testimonial) was still contributing its full,
// uncapped content height during THAT measurement pass (confirmed live:
// sampling the rendered row across five carousel auto-rotations showed
// the right column's height changing with every different student's
// testimonial length, even with flex-1/min-h-0/overflow-y-auto already
// applied), so the whole row kept visibly resizing every ~5 seconds.
//
// Explicitly measuring the LEFT column's own real height (result cards +
// Top Rankers -- neither depends on which carousel slide is showing) and
// applying it as a fixed pixel height on the row sidesteps grid's
// content-based auto-sizing entirely: once the row has a DEFINITE height
// (not "auto"), stretch alignment applies straightforwardly and the right
// column's own content (however tall) is clipped/scrolled to fit instead
// of ever influencing the row's size. The row's height now only changes
// when the LEFT column's real content changes (a different number of
// result cards or top rankers), never just because the carousel advanced.
// Real bug found live: below the `lg:` breakpoint the two columns stack
// (grid-cols-2 is lg-only), so applying the measured height + a single
// `1fr` row track unconditionally forced BOTH columns to compete for one
// explicit row sized to the left column's height alone -- the right
// column (the carousel) collapsed to 0 height and effectively vanished
// on mobile. The fix only applies the explicit height/row-track style
// once a `(min-width: 1024px)` media query (matching Tailwind's `lg：
// breakpoint) confirms the columns are actually side by side; on
// narrower viewports the row is left as a plain stacked grid with each
// column's own natural (auto) height, exactly as it behaves without this
// component at all.
const DESKTOP_QUERY = "(min-width: 1024px)";

export function EqualHeightRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [isDesktop, setIsDesktop] = useState(false);

  useLayoutEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const syncDesktop = () => setIsDesktop(mql.matches);
    syncDesktop();
    mql.addEventListener("change", syncDesktop);
    return () => mql.removeEventListener("change", syncDesktop);
  }, []);

  useLayoutEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const measure = () => setHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2" style={isDesktop && height ? { height, gridTemplateRows: "1fr" } : undefined}>
      {/* self-start: this column must NEVER stretch to match the row's
          own height, or measuring it here would be circular (its
          "natural" height would already reflect whatever the row was
          stretched to on a previous render, including the taller/shorter
          testimonial that render happened to catch). self-start keeps
          this measurement pure -- always the content's own true size,
          regardless of the row height ultimately applied below. */}
      <div ref={leftRef} className="flex flex-col gap-4 self-start">{left}</div>
      <div className="overflow-hidden">{right}</div>
    </div>
  );
}
