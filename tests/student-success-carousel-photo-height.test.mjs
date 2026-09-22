import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported problem: the student photo's own fixed aspect-ratio sized
// it shorter than the text column beside it (name/stats/quote), leaving a
// visible block of blank space below the photo whenever that column was
// taller -- which is most of the time. A relatively positioned wrapper
// stretches to the grid row's full height (the row's default stretch
// alignment), and the photo fills it edge to edge via `fill` +
// object-cover instead of a fixed aspect-ratio.
test("StudentSuccessCarousel's photo fills its grid cell's full height instead of leaving blank space below it", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.match(component, /className="relative mx-auto h-56 w-44 overflow-hidden rounded-2xl shadow-md sm:h-full"/);
  assert.match(component, /<Image src=\{student\.image\} alt=\{student\.imageAlt\} fill sizes="176px" className="object-cover object-top"\/>/);
  assert.doesNotMatch(component, /aspect-\[4\/5\]/);
});
