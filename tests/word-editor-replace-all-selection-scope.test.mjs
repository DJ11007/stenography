import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression test for a real bug: "Replace All" used to walk every text node
// under the whole editor root regardless of what was selected, so replacing
// "The" -> "SAMRADHI CLASSES" changed every occurrence in the entire
// document even when the admin had only selected one paragraph. Fixed to
// scope Replace All to the active selection when one exists (falling back
// to whole-document when nothing is selected, same as before).
test("Replace All scopes to the active selection instead of always replacing the whole document", async () => {
  const editor = await read(EDITOR);

  // A non-collapsed selection inside the editor becomes the scope range.
  assert.match(
    editor,
    /const scopeRange=selection&&selection\.rangeCount&&!selection\.isCollapsed&&editor\.current\.contains\(selection\.anchorNode\)&&editor\.current\.contains\(selection\.focusNode\)\?selection\.getRangeAt\(0\):null;/,
  );

  // Text nodes entirely outside the selection are skipped outright.
  assert.match(editor, /if\(scopeRange&&!scopeRange\.intersectsNode\(node\)\)continue;/);

  // Matches are bounds-checked against the selection's start/end offsets
  // within the boundary text nodes, not just "is this node touched at all".
  assert.match(editor, /const lo=scopeRange&&node===scopeRange\.startContainer\?scopeRange\.startOffset:0;/);
  assert.match(editor, /const hi=scopeRange&&node===scopeRange\.endContainer\?scopeRange\.endOffset:text\.length;/);
  assert.match(editor, /if\(start<lo\|\|end>hi\)continue;/);

  // With nothing selected, scopeRange is null, so lo/hi default to the
  // whole node -- Replace All still replaces every occurrence, unchanged
  // from before this fix.
  assert.match(editor, /const scopeRange=.*:null;/);

  // The status message tells the admin when a replace was scoped.
  assert.match(editor, /Replaced \$\{count\} occurrence\$\{count===1\?"":"s"\}\$\{scopeRange\?" in the selection":""\}\./);
});
