import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR_PATH = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("the global selectionchange listener is coalesced to at most one measurement per animation frame, instead of running its layout-forcing getComputedStyle call on every raw event", async () => {
  const editor = await read(EDITOR_PATH);
  // The raw listener registered with addEventListener must be the cheap
  // "remember" scheduler, not the expensive "measure" function directly --
  // otherwise every selectionchange event (there can be several per click)
  // forces its own synchronous layout.
  assert.match(editor, /const remember=\(\)=>\{if\(scheduled\)return;scheduled=true;requestAnimationFrame\(measure\)\}/);
  assert.match(editor, /document\.addEventListener\("selectionchange",remember\)/);
  assert.doesNotMatch(editor, /document\.addEventListener\("selectionchange",measure\)/);
});

test("a locally uploaded picture is inserted with a sane default size cap (not stretched to the full page width)", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /<img src="\$\{src\}" alt="Inserted picture" style="max-width:320px;max-height:320px;width:auto;height:auto">/);
  assert.doesNotMatch(editor, /<img src="\$\{src\}" alt="Inserted picture" style="max-width:100%/);
});

test("re-rendering a saved document snapshot also caps embedded image size -- the reload path had no size constraint at all before this fix", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /img\.style\.maxWidth="320px";img\.style\.maxHeight="320px";img\.style\.width="auto";img\.style\.height="auto"/);
});

test("an online picture is also capped to the same default size instead of the page-filling max-width:100% it used before", async () => {
  const tools = await read("lib/word-editor-browser-tools.ts");
  assert.match(tools, /image\.style\.maxWidth="320px";image\.style\.maxHeight="320px";image\.style\.width="auto";image\.style\.height="auto"/);
  assert.doesNotMatch(tools, /image\.style\.maxWidth="100%"/);
});
