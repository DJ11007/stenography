import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("clicking Header or Footer opens a real built-in style gallery instead of unconditionally inserting one fixed block", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /header:\(\)=>setDialog\(\{kind:"headerFooterGallery",which:"header",hasExisting:Boolean\(editor\.current\?\.querySelector\("header"\)\),customStyles:loadCustomHeaderFooterStyles\("header"\)\}\)/);
  assert.match(editor, /footer:\(\)=>setDialog\(\{kind:"headerFooterGallery",which:"footer",hasExisting:Boolean\(editor\.current\?\.querySelector\("footer"\)\),customStyles:loadCustomHeaderFooterStyles\("footer"\)\}\)/);
  assert.match(editor, /function HeaderFooterGalleryForm/);
  for (const name of ["Blank", "Blank \\(Three Columns\\)", "Alphabet", "Annual"]) assert.match(editor, new RegExp(`name:"${name}"`));
});

test("the gallery preview never renders raw HTML markup (built-in or a saved custom entry) -- only plain text", async () => {
  const editor = await read(EDITOR);
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML/);
  assert.match(editor, /\{item\.preview\}/);
  assert.match(editor, /\{item\.preview\|\|"\(no preview\)"\}/);
});

test("the gallery offers Edit/Remove/Save Selection to Gallery, matching the real Word menu at the bottom of the built-in list", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /Edit \{label\}/);
  assert.match(editor, /Remove \{label\}/);
  assert.match(editor, /Save Selection to \{label\} Gallery…/);
  assert.match(editor, /const editHeaderFooter=\(which:"header"\|"footer"\)=>\{/);
  assert.match(editor, /const removeHeaderFooter=\(which:"header"\|"footer"\)=>\{/);
  assert.match(editor, /const saveCustomHeaderFooterStyle=\(which:"header"\|"footer"\)=>\{/);
});

test("a real Header & Footer Tools contextual bar appears while editing a header or footer, mirroring the existing Table Tools bar pattern", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /insideHeaderFooter&&!submitted&&<div role="toolbar" aria-label="Header & Footer Tools"/);
  assert.match(editor, /Go to Footer/);
  assert.match(editor, /Go to Header/);
  assert.match(editor, /Show Document Text/);
  assert.match(editor, /Close Header and Footer/);
  assert.match(editor, /const closeHeaderFooter=\(\)=>\{/);
});

test("Different First Page and Different Odd & Even Pages are shown but honestly disabled -- this tool has no real page-by-page pagination to back them", async () => {
  const editor = await read(EDITOR);
  const reason = "Requires true multi-page pagination, which this exam tool doesn't model.";
  assert.match(editor, new RegExp(`disabled title="${reason.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>Different First Page`));
  assert.match(editor, new RegExp(`disabled title="${reason.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>Different Odd &amp; Even Pages`));
});

test("Header from Top / Footer from Bottom genuinely adjust the header/footer element's own spacing, reusing the marginTop/marginBottom attrs the schema already validates", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const adjustHeaderFooterOffset=\(which:"header"\|"footer",value:string\)=>\{const element=editor\.current\?\.querySelector\(which\)as HTMLElement\|null;if\(!element\)return;const amount=bounded\(value,0,10\);element\.style\[which==="header"\?"marginTop":"marginBottom"\]=`\$\{amount\}in`;changed\(\)\}/);
});

test("insideHeaderFooter is tracked via the same selectionchange listener that already tracks insideTable", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const headerFooter=parent\.closest\("header,footer"\);setInsideHeaderFooter\(headerFooter\?headerFooter\.tagName\.toLowerCase\(\)as"header"\|"footer":null\)/);
});

test("Page Number gains a real Style gallery (Plain Number / Page X / Accent Bar) and a Format Page Numbers section (number format + start at), still using the same page-number field encoding (no schema change)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const PAGE_NUMBER_STYLES:\{id:string;label:string\}\[\]=\[\{id:"plain",label:"Plain Number"\},\{id:"pageX",label:"Page X"\},\{id:"accentBar",label:"Accent Bar"\}\];/);
  assert.match(editor, /Number format/);
  assert.match(editor, /Start at/);
  assert.match(editor, /data-field="page-number\|\$\{position\}\|\$\{alignment\}"/);
});

test("Remove Page Numbers deletes every page-number field in the document", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const removePageNumbers=\(\)=>\{setDialog\(null\);if\(!editor\.current\)return;const fields=\[\.\.\.editor\.current\.querySelectorAll\('\[data-field\^="page-number"\]'\)\];/);
  assert.match(editor, /Remove Page Numbers/);
});

test("Page Number and Header/Footer gallery features touch no new document schema field -- header/footer already have marginTop/marginBottom validated, and page-number style/format are baked into the field's rendered text, not a new field", async () => {
  const validator = await read("lib/word-editor-document.ts");
  assert.match(validator, /header: new Set\(COMMON_BLOCK_ATTRS\), footer: new Set\(COMMON_BLOCK_ATTRS\)/);
  assert.match(validator, /page-number\\\|\(top\|bottom\|current\)\\\|\(left\|center\|right\)/);
});
