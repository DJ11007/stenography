import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

// Real reported bug: the admin counted paragraphs by eye while reviewing a
// Model Answer and thought one was missing -- turned out the underlying
// document was correct (verified directly against the saved data), but
// "Show/hide formatting marks" showed no ¶ paragraph numbers at all once
// any edit had ever been saved. The old implementation only ever rendered
// a static ¶{paragraph.paragraphNumber} span for the very first, unsaved
// render straight from the pristine Working Matter -- toSnapshot()/
// renderSnapshot(), used for every reload and every edit after that, never
// carried a paragraphNumber field forward, so the badge silently vanished
// forever after the first save. Fixed with a CSS counter that recomputes
// live from the actual rendered document structure instead of a stored
// field, so it works identically before AND after a save, and self-heals
// if a paragraph is ever added or removed.
test("the old dead paragraph-number badge (only ever rendered pre-save) is removed from the editor JSX", async () => {
  const editor = await read(EDITOR);
  assert.doesNotMatch(editor, /view\.formattingMarks&&paragraph\.paragraphNumber&&<span/);
  assert.doesNotMatch(editor, /¶\{paragraph\.paragraphNumber\}/);
});

test("paragraph numbers are shown via a CSS counter that recomputes from the live document, not a stored field -- so it survives every reload and every edit, not just the first render", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /counter-reset:\s*word-line-number\s+word-paragraph-number/);
  assert.match(css, /\.word-document-page\.show-formatting-marks\s*>\s*p:not\(\[data-block-type\]\)\s*\{\s*counter-increment:\s*word-paragraph-number/);
  assert.match(css, /content:\s*"¶"\s*counter\(word-paragraph-number\)\s*" "/);
});
