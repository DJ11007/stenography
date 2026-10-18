import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression test for a real, twice-reported bug: "Replace All" was meant to
// scope to the admin's selection (e.g. one selected paragraph), but the
// first fix for this read window.getSelection() fresh at the moment
// Replace/Replace All was actually clicked -- by then the admin had already
// typed into the dialog's own "Find what"/"Replace with" inputs, which
// moves focus (and getSelection()) off the document entirely. So replacing
// "The" -> "SAMRADHI CLASSES" with paragraph 3 selected still silently fell
// back to whole-document, exactly like nothing was ever selected.
//
// Real fix: the selection is captured once, in find(), the moment the
// dialog opens -- while it's still live -- into findScopeRange. Find
// Next/Replace/Replace All all use that captured range, never a fresh
// getSelection() read. The admin also gets an explicit "Find in: Selected
// text / Whole document" choice in the dialog (only shown when something
// was actually selected), instead of scope being an invisible side effect
// of what happened to be selected.
test("the selection scope is captured once when Find and Replace opens, not re-read from a live selection that the dialog's own inputs have already displaced", async () => {
  const editor = await read(EDITOR);

  // A dedicated ref, distinct from savedRange (which serves toolbar
  // formatting actions and can be overwritten while the dialog is open).
  assert.match(editor, /const findScopeRange=useRef<Range\|null>\(null\);/);

  // find() captures the live selection into findScopeRange the moment the
  // dialog opens, and records whether there was one on the dialog state.
  const findBody = editor.slice(editor.indexOf("const find=(replace:boolean)=>{"), editor.indexOf("const goToTarget="));
  assert.match(findBody, /findScopeRange\.current=scopeRange;/);
  assert.match(findBody, /hadSelection:Boolean\(scopeRange\)/);
  assert.match(findBody, /selection\.getRangeAt\(0\)\.cloneRange\(\)/);

  // Every action takes an explicit scope: "selection" resolves to the captured findScopeRange,
  // and matches are kept only when they lie entirely inside it.
  assert.match(editor, /scope:"selection"\|"document"/);
  assert.match(editor, /const scopeRange=scope==="selection"\?findScopeRange\.current:null;/);
  assert.match(editor, /scopeRange\.compareBoundaryPoints\(Range\.START_TO_START,range!\)<=0&&scopeRange\.compareBoundaryPoints\(Range\.END_TO_END,range!\)>=0/);

  // The status message tells the user when a replace was scoped.
  assert.match(editor, /Replaced \$\{count\} occurrence\$\{count===1\?"":"s"\}\$\{scope==="selection"\?" in the selection":""\}\./);
});

test("Find In is available as soon as Find what has text (as in Word 2013); Current Selection only when something was selected, and picking a scope marks every match in it", async () => {
  const dialogs = await readFile(new URL("../components/word-efficiency/word-2013-dialogs.tsx", import.meta.url), "utf8");
  assert.match(dialogs, /useState<Scope>\(dialog\.hadSelection \? "selection" : "document"\)/);
  assert.match(dialogs, /<MenuButton13 label="Find In" disabled=\{!canRun\}/);
  assert.match(dialogs, /\{ id: "selection", label: "Current Selection", disabled: !dialog\.hadSelection \}/);
  // As in Word 2013: Find In selects every match, reports the count, turns Cancel into Close,
  // and an "Options:" line lists the search options in effect.
  assert.match(dialogs, /setMessage\(onSelectAll\(query, options, picked\)\)/);
  assert.match(dialogs, /\{searched \? "Close" : "Cancel"\}/);
  assert.match(dialogs, /options\.matchCase \? "Match Case"/);
  assert.match(dialogs, /Main Document/);
  assert.match(dialogs, /Current Selection/);
  // The choice is actually threaded into every action, not just displayed.
  assert.match(dialogs, /onFindNext\(query, options, scope\)/);
  assert.match(dialogs, /onReplaceOne\(query, replacement, options, scope, replaceFormat\)/);
  assert.match(dialogs, /onReplaceAll\(query, replacement, options, scope, replaceFormat\)/);
});
