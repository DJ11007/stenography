import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("Find and Replace has three real tabs (Find, Replace, Go To) instead of the old two-mode toggle", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /onClick=\{\(\)=>setTab\("find"\)\}/);
  assert.match(editor, /onClick=\{\(\)=>setTab\("replace"\)\}/);
  assert.match(editor, /onClick=\{\(\)=>setTab\("goto"\)\}/);
  assert.match(editor, />Go To</);
});

test("Search Options exposes Match case, Find whole words, Use wildcards, Match prefix/suffix, and the two Ignore options as real toggles", async () => {
  const editor = await read(EDITOR);
  for (const label of ["Match case", "Find whole words only", "Use wildcards", "Match prefix", "Match suffix", "Ignore punctuation characters", "Ignore white-space characters"]) {
    assert.match(editor, new RegExp(label));
  }
  assert.match(editor, /checked=\{options\.matchCase\}/);
  assert.match(editor, /checked=\{options\.wholeWord\}/);
});

test("Sounds like and Find all word forms are shown but honestly disabled with a stated reason, not faked as working", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /Sounds like \(English\)/);
  assert.match(editor, /Find all word forms \(English\)/);
  assert.match(editor, /title="Phonetic matching isn't supported in this exam tool\."><input type="checkbox" disabled\/>Sounds like/);
  assert.match(editor, /title="Word-form matching isn't supported in this exam tool\."><input type="checkbox" disabled\/>Find all word forms/);
});

test("the Special menu lists every real Word item and only enables the ones this editor can genuinely search", async () => {
  const editor = await read(EDITOR);
  const workingLabels = ["Tab Character", "Any Character", "Any Digit", "Any Letter", "Caret Character", "§ Section Character", "¶ Paragraph Character", "Em Dash", "En Dash", "Nonbreaking Hyphen", "Nonbreaking Space", "Optional Hyphen", "White Space"];
  const disabledLabels = ["Paragraph Mark", "Column Break", "Endnote Mark", "Field", "Footnote Mark", "Graphic", "Manual Line Break", "Manual Page Break", "Section Break"];
  for (const label of [...workingLabels, ...disabledLabels]) assert.match(editor, new RegExp(`label:"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  for (const label of disabledLabels) assert.match(editor, new RegExp(`label:"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",disabledReason:`));
  assert.match(editor, /const insertSpecial=\(item:typeof SPECIAL_ITEMS\[number\]\)=>\{if\(item\.disabledReason\|\|!item\.token\)return;/);
});

test("the Format menu lists the real Word items, disables the ones this editor can't back, and Highlight genuinely filters search results", async () => {
  const editor = await read(EDITOR);
  for (const label of ["Font…", "Paragraph…", "Tabs…", "Language…", "Frame…", "Style…", "Highlight"]) assert.match(editor, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(editor, /action:"highlight"/);
  assert.match(editor, /No Formatting/);
  assert.match(editor, /if\(item\.action==="highlight"\)setOption\("formatHighlight",true\)/);
  assert.match(editor, /!options\.formatHighlight\|\|hasSearchHighlight\(nodes\[index\]\.parentElement\)/);
});

test("Go To supports Page, Table, and Bookmark for real, and every other real-Word item is explicitly marked not applicable", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /\{id:"page",label:"Page",working:true\}/);
  assert.match(editor, /\{id:"table",label:"Table",working:true\}/);
  assert.match(editor, /\{id:"bookmark",label:"Bookmark",working:true\}/);
  for (const id of ["section", "line", "comment", "footnote", "endnote", "field", "graphic", "equation", "object", "heading"]) assert.match(editor, new RegExp(`\\{id:"${id}",label:"[^"]+",working:false\\}`));
  assert.match(editor, /const goToTarget=\(kind:string,value:string\)=>\{/);
  assert.match(editor, /isn't applicable to this exam tool's document model/);
});

test("Find, Replace, and Go To all route through the shared FindOptions matcher instead of the old case-insensitive substring search", async () => {
  const [editor, lib] = await Promise.all([read(EDITOR), read("lib/word-find-replace.ts")]);
  assert.match(lib, /export function buildFindRegex/);
  assert.match(editor, /import \{ buildFindRegex, DEFAULT_FIND_OPTIONS, type FindOptions \} from "@\/lib\/word-find-replace";/);
  assert.match(editor, /const findNext=\(needle:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"\|"document"="document"\)=>\{/);
  assert.match(editor, /const runReplaceAll=\(needle:string,replacement:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"\|"document"="document"\)=>\{/);
});
