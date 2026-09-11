import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { KEYBOARD_ROWS } from "../lib/krutidev-tutor-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const homeKeyBy = () => {
  const byKey = new Map();
  for (const row of KEYBOARD_ROWS) for (const cap of row) byKey.set(cap.key, cap);
  return byKey;
};

// Kruti Dev's touch-typing convention (reported): the left hand rests one
// key right of standard QWERTY -- pinky on S (not A, which is left unused),
// ring on D, middle on F, index on G with H as its reach. The right hand is
// unchanged: home stays J K L ;, with ' as the pinky's own reach (freed up
// now that H no longer needs to be shared with the right hand).
test("the Kruti Dev keyboard diagram uses the shifted left-hand home row (S D F G, A unused) while the right hand stays J K L ;", () => {
  const byKey = homeKeyBy();
  assert.equal(byKey.get("a").finger, "l-pinky");
  assert.equal(byKey.get("a").home, undefined);
  assert.equal(byKey.get("s").finger, "l-pinky");
  assert.equal(byKey.get("s").home, true);
  assert.equal(byKey.get("d").finger, "l-ring");
  assert.equal(byKey.get("d").home, true);
  assert.equal(byKey.get("f").finger, "l-middle");
  assert.equal(byKey.get("f").home, true);
  assert.equal(byKey.get("g").finger, "l-index");
  assert.equal(byKey.get("g").home, true);
  assert.equal(byKey.get("h").finger, "l-index");
  assert.equal(byKey.get("h").home, undefined);

  assert.equal(byKey.get("j").finger, "r-index");
  assert.equal(byKey.get("j").home, true);
  assert.equal(byKey.get("k").finger, "r-middle");
  assert.equal(byKey.get("k").home, true);
  assert.equal(byKey.get("l").finger, "r-ring");
  assert.equal(byKey.get("l").home, true);
  assert.equal(byKey.get(";").finger, "r-pinky");
  assert.equal(byKey.get(";").home, true);
  assert.equal(byKey.get("'").finger, "r-pinky");
  assert.equal(byKey.get("'").home, undefined);
});

test("the Instructions step's caption names the shifted left-hand home row", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  assert.match(tutor, /<b>S D F G<\/b> पर और दायें हाथ की अंगुलियाँ <b>J K L ;<\/b>/);
  assert.doesNotMatch(tutor, /<b>A S D F<\/b>/);
});
