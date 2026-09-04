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
  const findBody = editor.slice(editor.indexOf("const find=(replace:boolean)=>{"), editor.indexOf("const runFindNext="));
  assert.match(findBody, /findScopeRange\.current=scopeRange;/);
  assert.match(findBody, /hadSelection:Boolean\(scopeRange\)/);
  assert.match(findBody, /selection\.getRangeAt\(0\)\.cloneRange\(\)/);

  // findNext, runFindNext, runReplaceOne, and runReplaceAll all take an
  // explicit scope parameter -- "selection" resolves to findScopeRange, not
  // a fresh getSelection() call.
  assert.match(editor, /scope:"selection"\|"document"="document"/);
  assert.match(editor, /const scopeRange=scope==="selection"\?findScopeRange\.current:null;/);

  // Text nodes entirely outside the scope are skipped, and matches are
  // bounds-checked against the scope's start/end offsets, not just "is this
  // node touched at all" -- unchanged from the original scoping math.
  assert.match(editor, /if\(scopeRange&&!scopeRange\.intersectsNode\(node\)\)continue;/);
  assert.match(editor, /const lo=scopeRange&&node===scopeRange\.startContainer\?scopeRange\.startOffset:0;/);
  assert.match(editor, /const hi=scopeRange&&node===scopeRange\.endContainer\?scopeRange\.endOffset:text\.length;/);
  assert.match(editor, /if\(start<lo\|\|end>hi\)continue;/);

  // With scope="document" (or nothing ever selected), scopeRange is null,
  // so Replace All still replaces every occurrence, unchanged from before.

  // The status message tells the admin when a replace was scoped.
  assert.match(editor, /Replaced \$\{count\} occurrence\$\{count===1\?"":"s"\}\$\{scopeRange\?" in the selection":""\}\./);
});

test("the dialog offers an explicit \"Find in: Selected text / Whole document\" choice, only when something was actually selected", async () => {
  const editor = await read(EDITOR);
  const formBody = editor.slice(editor.indexOf("function FindReplaceForm("));
  assert.match(formBody, /const\[scope,setScope\]=useState<"selection"\|"document">\(dialog\.hadSelection\?"selection":"document"\);/);
  assert.match(formBody, /\{dialog\.hadSelection&&<div className="mt-3">/);
  assert.match(formBody, /Find in:/);
  assert.match(formBody, /onClick=\{\(\)=>setScope\("selection"\)\}/);
  assert.match(formBody, /onClick=\{\(\)=>setScope\("document"\)\}/);
  assert.match(formBody, />Selected text</);
  assert.match(formBody, />Whole document</);
  // The choice is actually threaded into every action, not just displayed.
  assert.match(formBody, /onClick=\{\(\)=>onFindNext\(query,options,scope\)\}/);
  assert.match(formBody, /onClick=\{\(\)=>onReplaceOne\(query,replacement,options,scope\)\}/);
  assert.match(formBody, /onClick=\{\(\)=>onReplaceAll\(query,replacement,options,scope\)\}/);
});
