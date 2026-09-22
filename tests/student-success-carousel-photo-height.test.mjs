import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported follow-up: an earlier fix stretched the photo edge-to-edge
// to fill the grid row's full height, but for a short text column that
// still revealed an awkwardly tall, elongated crop below the face. Now the
// photo keeps its normal aspect-[4/5] portrait size and is vertically
// CENTERED (not top-anchored) inside a wrapper that stretches to the
// row's height -- a well-composed headshot, with any leftover height
// split evenly above/below instead of a blank strip pinned below it.
test("StudentSuccessCarousel keeps the photo at its natural aspect-[4/5] size and centers it within a row-stretched wrapper", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.match(component, /className="mx-auto flex w-44 items-center justify-center sm:h-full"/);
  assert.match(component, /<Image src=\{student\.image\} alt=\{student\.imageAlt\} width=\{1024\} height=\{1280\} className="aspect-\[4\/5\] w-44 rounded-2xl object-cover object-top shadow-md"\/>/);
  assert.doesNotMatch(component, /\bfill\b sizes=/, "must not force-fill the photo to its container's full height");
});
