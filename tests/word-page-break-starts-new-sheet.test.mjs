import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");

// Hindi Word Test 5 Q13 (22 Nov 2026): Insert > Page Break only drew its line -- the table after it stayed on the same
// sheet. As in Word, what follows a Page Break (or a Next Page section break) starts at the top of the next sheet.
test("pagination starts the block after a Page Break at the top of the next sheet", () => {
  const paginate = editor.slice(editor.indexOf("function paginatePages("), editor.indexOf("function paragraphLines("));
  assert.match(paginate, /block\.tagName === "HR" && \(breakKind === "page-break" \|\| breakKind === "section-break"\)/);
  assert.match(paginate, /breakSheet = sheetOf\(/);
  assert.match(paginate, /nextSheetTop = \(breakSheet \+ 1\) \* step \+ bodyTop/);
  assert.match(paginate, /if \(startTop < nextSheetTop - 0\.5\) moveTo\(block, startTop, nextSheetTop\)/);
  // The push is display only: it is cleared before every layout and never saved (takeState strips data-page-push).
  assert.match(editor, /for\(const block of clone\.querySelectorAll<HTMLElement>\("\[data-page-push\]"\)\)\{block\.removeAttribute\("data-page-push"\)/);
});
