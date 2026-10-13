import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const DIALOGS = "components/word-efficiency/word-2013-dialogs.tsx";
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("Find and Replace is a Word 2013 dialog with three real tabs: Find, Replace and Go To", async () => {
  const dialogs = await read(DIALOGS);
  assert.match(dialogs, /<Window13 title="Find and Replace"/);
  for (const id of ["find", "replace", "goto"]) assert.match(dialogs, new RegExp(`\\{ id: "${id}", label:`));
  assert.match(dialogs, /<Button13 onClick=\{\(\) => setMore\(value => !value\)\}>\{more \? "<< Less" : "More >>"\}<\/Button13>/);
});

test("Search Options: every Word option is a real control wired into the search engine options", async () => {
  const dialogs = await read(DIALOGS);
  for (const label of ["Mat<u>c</u>h case", "Find whole words onl<u>y</u>", "Use wil<u>d</u>cards", "Match prefi<u>x</u>", "Match suffi<u>x</u>", "Ignore punctuation characters", "Ignore white-space characters", "Sounds li<u>k</u>e \\(English\\)", "Find all <u>w</u>ord forms \\(English\\)"]) assert.match(dialogs, new RegExp(label));
  for (const key of ["matchCase", "wholeWord", "wildcards", "matchPrefix", "matchSuffix", "ignorePunctuation", "ignoreWhitespace", "soundsLike", "allWordForms"]) assert.match(dialogs, new RegExp(`options\\.${key}`));
  // Word turns the incompatible options off while wildcards are on.
  assert.match(dialogs, /disabled=\{wild\}/);
});

test("Sounds like and Find all word forms really search (engine), they are not disabled placeholders", async () => {
  const [dialogs, engine] = await Promise.all([read(DIALOGS), read("lib/word-find-engine.ts")]);
  assert.doesNotMatch(dialogs, /isn't supported in this exam tool/);
  assert.match(engine, /export function soundex/);
  assert.match(engine, /export function wordForms/);
  assert.match(engine, /options\.soundsLike/);
  assert.match(engine, /options\.allWordForms/);
});

test("the Special menu lists all 22 Word items and inserts the real ^ codes", async () => {
  const dialogs = await read(DIALOGS);
  const labels = ["Paragraph Mark", "Tab Character", "Any Character", "Any Digit", "Any Letter", "Caret Character", "§ Section Character", "¶ Paragraph Character", "Column Break", "Em Dash", "En Dash", "Endnote Mark", "Field", "Footnote Mark", "Graphic", "Manual Line Break", "Manual Page Break", "Nonbreaking Hyphen", "Nonbreaking Space", "Optional Hyphen", "Section Break", "White Space"];
  for (const label of labels) assert.match(dialogs, new RegExp(`label: "${label}", code: "\\^`));
  assert.equal((dialogs.match(/\{ id: "[^"]+", label: "[^"]+", code: "\^[^"]+" \}/g) || []).length, 22);
  assert.match(dialogs, /const insertSpecial = \(id: string\) =>/);
});

test("the Format menu offers Font…, Paragraph… and Highlight as real search criteria; the rest are disabled with a stated reason", async () => {
  const [dialogs, engine] = await Promise.all([read(DIALOGS), read("lib/word-find-engine.ts")]);
  for (const label of ["Font…", "Paragraph…", "Tabs…", "Language…", "Frame…", "Style…", "Highlight"]) assert.match(dialogs, new RegExp(label));
  assert.match(dialogs, /No Formatting/);
  assert.match(dialogs, /FindFormatPanel/);
  assert.match(engine, /export function matchSatisfiesFormat/);
  assert.match(engine, /export function formatOnlyMatches/);
  for (const id of ["tabs", "language", "frame", "style"]) assert.match(dialogs, new RegExp(`id: "${id}"[^}]*disabled: true, title:`));
});

test("Go To supports Page, Table and Bookmark for real, and every other Word item is marked not applicable", async () => {
  const [dialogs, editor] = await Promise.all([read(DIALOGS), read(EDITOR)]);
  for (const id of ["page", "table", "bookmark"]) assert.match(dialogs, new RegExp(`\\{ id: "${id}", label: "[^"]+", working: true \\}`));
  for (const id of ["section", "line", "comment", "footnote", "endnote", "field", "graphic", "equation", "object", "heading"]) assert.match(dialogs, new RegExp(`\\{ id: "${id}", label: "[^"]+", working: false \\}`));
  assert.match(editor, /const goToTarget=\(kind:string,value:string\)=>\{/);
  assert.match(dialogs, /isn&apos;t applicable to this exam tool&apos;s document model|is not applicable to this exam tool&apos;s document model|isn't applicable to this exam tool's document model/);
});

test("Find Next, Replace and Replace All all run through the shared Word search engine", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /from "@\/lib\/word-find-engine"/);
  assert.match(editor, /const collectMatches=\(needle:string,options:FindEngineOptions,scope/);
  assert.match(editor, /buildDocumentText\(root\)/);
  assert.match(editor, /const runReplaceAll=/);
  assert.match(editor, /expandReplacement\(replacement/);
});
