import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EDITOR_PATH = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = () => readFile(new URL(`../${EDITOR_PATH}`, import.meta.url), "utf8");

// approvedColor() is not exported (it's a private helper inline in a large
// "use client" component with real DOM APIs), so it can't be imported and
// called directly the way lib/word-find-replace.ts's pure functions can.
// This mirrors the exact fixed regex/logic out of the source file so the
// actual parsing behavior is exercised against concrete browser-style
// getComputedStyle() strings, not just "the right substring is present".
function extractApprovedColor(source) {
  const match = source.match(/function approvedColor\(value:string\)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}function approvedCssColor/);
  if (!match) throw new Error("approvedColor implementation not found in source");
  // eslint-disable-next-line no-new-func -- reconstructing the real function body verbatim to test its actual behavior
  return new Function("value", match[1]);
}

test("getComputedStyle's default 'no background set' value (rgba(0, 0, 0, 0), fully transparent) is treated as no color at all, not opaque black", async () => {
  const approvedColor = extractApprovedColor(await read());
  assert.equal(approvedColor("rgba(0, 0, 0, 0)"), null);
});

test("a genuinely applied opaque black (rgb with no alpha, or alpha 1) still parses as 000000 -- a real black highlight/color still works", async () => {
  const approvedColor = extractApprovedColor(await read());
  assert.equal(approvedColor("rgb(0, 0, 0)"), "000000");
  assert.equal(approvedColor("rgba(0, 0, 0, 1)"), "000000");
});

test("a normal opaque highlight color still round-trips correctly", async () => {
  const approvedColor = extractApprovedColor(await read());
  assert.equal(approvedColor("rgb(255, 255, 0)"), "FFFF00");
  assert.equal(approvedColor("rgba(255, 0, 0, 1)"), "FF0000");
  assert.equal(approvedColor("#ff0000"), "FF0000");
});

test("any other fully transparent color (not just black) is also treated as no color, e.g. a transparent red", async () => {
  const approvedColor = extractApprovedColor(await read());
  assert.equal(approvedColor("rgba(255, 0, 0, 0)"), null);
});

test("garbage input still safely returns null instead of throwing", async () => {
  const approvedColor = extractApprovedColor(await read());
  assert.equal(approvedColor("not-a-color"), null);
  assert.equal(approvedColor(""), null);
});
