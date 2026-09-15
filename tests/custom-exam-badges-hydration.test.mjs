import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const BADGES_PATH = "app/typing/exams/_components/custom-exam-badges.tsx";

// Real reported bug: "A tree hydrated but some attributes of the server
// rendered HTML didn't match the client properties" on an SVG <line>'s y2
// coordinate (90.32627619667346 vs 90.32627619667345 -- differing only in
// the 17th significant digit). Math.cos/Math.sin on the exact same angle
// can differ in their last digit between the server's Node.js V8 and the
// client browser's V8 (different native math library builds); rounding to
// 3 decimals -- far more precision than a 100x100 viewBox icon needs --
// makes the server- and client-rendered strings identical every time.
test("every trig-based badge coordinate is rounded through r3(), not passed raw from Math.cos/Math.sin", async () => {
  const source = await read(BADGES_PATH);
  assert.match(source, /const r3 = \(n: number\) => Math\.round\(n \* 1000\) \/ 1000;/);
  // No remaining raw (unrounded) "50 + N * Math.cos/sin(a)" coordinate --
  // every one of the six original sites now goes through r3(...), whether
  // the radius is a numeric literal (most sites) or the rOut variable
  // (BombayHcClerkBadge's polygon).
  assert.doesNotMatch(source, /[^(]50 \+ (?:[\d.]+|rOut) \* Math\.(cos|sin)\(a\)/);
  const matches = [...source.matchAll(/r3\(50 \+ (?:[\d.]+|rOut) \* Math\.(cos|sin)\(a\)\)/g)];
  assert.equal(matches.length, 20, `expected all 20 trig coordinate expressions (4 per line-pair x4 line-based badges, 2 for the polygon, 2 for the lone circle) to be wrapped in r3(), found ${matches.length}`);
});

test("r3() rounds to 3 decimal places, collapsing the exact reported mismatch to one identical value", () => {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  assert.equal(r3(90.32627619667346), r3(90.32627619667345));
  assert.equal(r3(90.32627619667346), 90.326);
});
