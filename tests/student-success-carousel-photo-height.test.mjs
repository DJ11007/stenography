import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested reorganization: the photo moved from a left-hand column
// to the top-right corner, at the SAME visual size (w-44/aspect-[4/5],
// unchanged) -- object-cover keeps every student's photo cropped to the
// same frame regardless of their own source image's proportions.
// `flex-col-reverse` + `sm:flex-row` is the mechanism: on mobile the last
// DOM child (the photo) renders visually first (same as the old
// left-column layout's mobile stacking), and at `sm:` it becomes a normal
// left-to-right row, putting the photo on the right.
test("StudentSuccessCarousel's photo sits top-right at its unchanged size (w-44/aspect-[4/5], object-cover), via flex-col-reverse + sm:flex-row so it still stacks first on mobile", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.match(component, /className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between"/);
  assert.match(component, /<Image src=\{student\.image\} alt=\{student\.imageAlt\} width=\{1024\} height=\{1280\} className="mx-auto aspect-\[4\/5\] w-44 shrink-0 rounded-2xl object-cover object-top shadow-md sm:mx-0"\/>/);
});

// Real requested follow-up: with the testimonial's own length no longer
// capped, the whole card's height (and the Top Rankers columns beside
// it, via CSS grid stretch) visibly resized every time the carousel
// auto-rotated to a student with a longer/shorter message. Fixed by
// making the testimonial `flex-1 min-h-0 overflow-y-auto` inside a
// `flex h-full flex-col` card: the header/stats stay their natural size
// (so they -- not testimonial length -- determine the card's own
// content-based size for grid purposes), and the testimonial fills
// whatever space is actually available, scrolling internally only in the
// rare case a message doesn't fit, instead of ever resizing the card
// around it. min-h-0 is required for the same reason min-w-0 mattered
// for the leaderboard row's name truncation -- without it, overflow-auto
// on a flex child never actually gets a chance to engage.
test("the testimonial no longer dictates the card's height -- it's flex-1/min-h-0/overflow-y-auto, a safety net rather than the thing driving the card's size", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.doesNotMatch(component, /max-h-40 overflow-y-auto/);
  assert.match(component, /className="student-slide flex h-full flex-col"/);
  assert.match(component, /<blockquote className="mt-4 min-h-0 w-full flex-1 overflow-y-auto rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm font-semibold leading-7 text-slate-800">/);
});

// Real requested layout: stats and the testimonial span the full card
// width, below the heading/photo row -- not squeezed into the old
// left-hand text column.
test("the stats grid and testimonial render below the heading/photo row, spanning the full card width", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  const headingRowIndex = component.indexOf('className="flex flex-col-reverse gap-4 sm:flex-row');
  const statsIndex = component.indexOf("<dl className=\"mt-4 grid gap-3 text-sm sm:grid-cols-2\">");
  const quoteIndex = component.indexOf("<blockquote");
  assert.ok(headingRowIndex > 0 && statsIndex > headingRowIndex && quoteIndex > statsIndex);
});
