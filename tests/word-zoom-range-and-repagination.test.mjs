import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// Word's zoom runs 10%-500% with 100% at the middle of the slider; ours stopped at 25% and 200%.
test("the status-bar zoom slider and buttons cover Word's 10%-500%", async () => {
  const chrome = await read("../components/word-efficiency/word-window-chrome.tsx");
  assert.match(chrome, /export const ZOOM_MIN = 10, ZOOM_MAX = 500;/);
  assert.match(chrome, /min=\{0\} max=\{100\} step=\{0\.125\} value=\{position\}/);
  assert.doesNotMatch(chrome, /min=\{25\} max=\{200\}/);
  assert.match(chrome, /Math\.max\(ZOOM_MIN, /);
  assert.match(chrome, /Math\.min\(ZOOM_MAX, /);
  // 100% sits in the middle: position 50.
  const ZOOM_MIN = 10, ZOOM_MAX = 500;
  const position = (z) => z <= 100 ? (z - ZOOM_MIN) / (100 - ZOOM_MIN) * 50 : 50 + (z - 100) / (ZOOM_MAX - 100) * 50;
  const fromPosition = (v) => Math.round(v <= 50 ? ZOOM_MIN + v / 50 * (100 - ZOOM_MIN) : 100 + (v - 50) / 50 * (ZOOM_MAX - 100));
  assert.equal(position(100), 50);
  for (const z of [10, 25, 50, 75, 100, 150, 200, 300, 500]) assert.equal(fromPosition(position(z)), z);
});

// The page breaks were worked out once and kept when the zoom changed; at 25% Chrome draws table borders and lines a
// little taller, so a row hung below the bottom margin. The pages are now laid out again for each zoom, page size,
// orientation and margin.
test("the pages are laid out again when the zoom, paper or margins change", async () => {
  const editor = await read("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /paginationKey=useRef\(""\)/);
  assert.match(editor, /const layoutKey=`\$\{pageWidth\}\|\$\{Math\.round\(pageHeight\*10\)\}\|\$\{zoomScale\}\|\$\{cs\.paddingTop\}\|\$\{cs\.paddingRight\}\|\$\{cs\.paddingBottom\}\|\$\{cs\.paddingLeft\}`;/);
  assert.match(editor, /if\(pageHeight>0&&\(paginationDirty\.current\|\|paginationKey\.current!==layoutKey\)\)/);
  assert.doesNotMatch(editor, /paginationWidth/);
  // Fit to page width / one page / two pages may also go down to 10% and up to 500%.
  assert.doesNotMatch(editor, /\*100\)\),(25,200|15,150)\)/);
});
