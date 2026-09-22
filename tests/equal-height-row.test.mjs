import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: pairing the homepage's Top Rankers/results column
// with the Student Success Story carousel in a plain CSS grid meant the
// whole row visibly resized every ~5 seconds as the carousel rotated
// through students with different testimonial lengths -- grid's default
// stretch alignment only applies AFTER computing each auto row track's
// height from every item's own content-based intrinsic size, so even a
// flex-1/min-h-0/overflow-y-auto testimonial still influenced that
// measurement pass (confirmed live: sampling five real carousel
// rotations showed the right column's height varying 786-1118px despite
// that CSS already being applied). EqualHeightRow sidesteps this by
// JS-measuring the left column's own true height and applying it as a
// fixed pixel height on the row, so grid's auto-sizing never gets a
// chance to read the right column's content size at all.
test("EqualHeightRow measures the left column via useLayoutEffect + ResizeObserver and applies it as a fixed row height", async () => {
  const component = await read("app/_components/equal-height-row.tsx");
  assert.match(component, /"use client";/);
  assert.match(component, /useLayoutEffect\(\(\) => \{/);
  assert.match(component, /new ResizeObserver\(measure\)/);
  assert.match(component, /style=\{isDesktop && height \? \{ height, gridTemplateRows: "1fr" \} : undefined\}/);
});

// Real bug found live: below the `lg:` breakpoint the two columns stack
// (grid-cols-2 is lg-only), so applying the fixed height unconditionally
// forced both columns to compete for one explicit row sized to the left
// column alone -- the right column (the carousel) collapsed to 0 height
// and vanished entirely on mobile. Gating the explicit height behind a
// `(min-width: 1024px)` match (Tailwind's `lg` breakpoint) leaves the
// row as a plain stacked grid with natural per-column height below that
// width, matching how it behaves without this component at all.
test("the explicit height/row-track style is gated to a (min-width: 1024px) match, so mobile keeps its natural stacked auto-height layout", async () => {
  const component = await read("app/_components/equal-height-row.tsx");
  assert.match(component, /const DESKTOP_QUERY = "\(min-width: 1024px\)";/);
  assert.match(component, /window\.matchMedia\(DESKTOP_QUERY\)/);
  assert.match(component, /const \[isDesktop, setIsDesktop\] = useState\(false\);/);
});

// Real bug avoided: if the measured left column were also stretched to
// match the row's own height, measuring it would be circular -- its
// "natural" height would already reflect whatever the row was stretched
// to on a previous render (including whichever testimonial length that
// render happened to catch). self-start keeps the measurement pure.
test("the measured left column uses self-start so it is never stretched, keeping the measurement uncorrupted by the row's own applied height", async () => {
  const component = await read("app/_components/equal-height-row.tsx");
  assert.match(component, /<div ref=\{leftRef\} className="flex flex-col gap-4 self-start">\{left\}<\/div>/);
});

test("the right column is clipped/scrolled to the locked row height instead of ever influencing it", async () => {
  const component = await read("app/_components/equal-height-row.tsx");
  assert.match(component, /<div className="overflow-hidden">\{right\}<\/div>/);
});
