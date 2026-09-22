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

// Real requested change: the testimonial used to be capped at max-h-40
// with its own internal scroll, which could hide part of a longer
// message. It must now fit inside the card in full, never truncated.
test("the testimonial is no longer height-capped or internally scrollable -- it renders in full", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.doesNotMatch(component, /max-h-40 overflow-y-auto/);
  assert.match(component, /<blockquote className="mt-4 w-full rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm font-semibold leading-7 text-slate-800">/);
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
