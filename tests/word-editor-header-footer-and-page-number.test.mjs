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

test("a real Header & Footer Tools > Design contextual ribbon tab appears and auto-selects while editing a header or footer, matching real Word instead of a flat toolbar bar", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /extraTabs=\{\[\.\.\.\(hfKind\?\[\{id:"hf-design",label:"Design",contextLabel:"Header & Footer Tools",groups:headerFooterToolsGroups\}\]:\[\]\)/);
  assert.match(editor, /activeExtraTab=\{headerFooterToolsSelected\?"hf-design":/);
  assert.match(editor, /if\(nowInside&&!wasInsideHeaderFooter\.current\)setHeaderFooterToolsSelected\(true\)/);
  assert.match(editor, /if\(!nowInside&&wasInsideHeaderFooter\.current\)\{setHeaderFooterToolsSelected\(false\);dropEmptyHeaderFooter\(\)\}/);
  assert.match(editor, /<HeaderFooterToolsGroups key=\{hfRev\} kind=\{hfKind\}/);
  const tools = await read("components/word-efficiency/word-header-footer-tools.tsx");
  for (const label of ["Go to\\nHeader", "Go to\\nFooter", "Show Document Text", "Close Header\\nand Footer", "Date &\\nTime", "Header from Top:"]) assert.ok(tools.includes(label), label);
  assert.match(editor, /const closeHeaderFooter=\(\)=>\{/);
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /extraTabs\?: \{ id: string; label: string; contextLabel: string; groups: ReactNode \}\[\]/);
  assert.match(ribbon, /word-ribbon-context-banner/);
});

test("Different First Page and Different Odd & Even Pages are shown but honestly disabled -- this tool has no real page-by-page pagination to back them", async () => {
  const tools = await read("components/word-efficiency/word-header-footer-tools.tsx");
  assert.match(tools, /<input type="checkbox" disabled checked=\{false\} onChange=\{\(\) => undefined\} \/><span>Different First Page<\/span>/);
  assert.match(tools, /<input type="checkbox" disabled checked=\{false\} onChange=\{\(\) => undefined\} \/><span>Different Odd &amp; Even Pages<\/span>/);
});

test("Header from Top / Footer from Bottom (in cm, as Word shows them) set the header/footer element's own marginTop/marginBottom, which the schema already validates", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(action==="headerFromTop"\|\|action==="footerFromBottom"\)\{const which=action==="headerFromTop"\?"header":"footer";const element=editor\.current\?\.querySelector\(which\)as HTMLElement\|null;if\(!element\)return;element\.style\[which==="header"\?"marginTop":"marginBottom"\]=`\$\{Number\(value\)\}cm`;changed\(\)/);
});

test("double-clicking the top or bottom of the page enters the header or footer, and Esc / Close leave it (dropping an empty one)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /<div ref=\{editor\} onDoubleClick=\{headerFooterDoubleClick\}/);
  assert.match(editor, /if\(first&&event\.clientY<first\.top\)\{event\.preventDefault\(\);editHeaderFooter\("header"\);return\}/);
  assert.match(editor, /if\(last&&event\.clientY>last\.bottom\)\{event\.preventDefault\(\);editHeaderFooter\("footer"\)\}/);
  assert.match(editor, /event\.key==="Escape"&&!dialog\)\{event\.preventDefault\(\);closeHeaderFooterRef\.current\(\)\}/);
  assert.match(editor, /setInsideHeaderFooter\(null\);\n  dropEmptyHeaderFooter\(\);/);
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

test("a single click (or arrow key) never enters the header/footer -- only a double-click, the Header menu or Go to Header does, as in Word", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /hfMode=useRef<"header"\|"footer"\|null>\(null\)/);
  // the selection is kept inside the area being edited (the body unless in header mode)
  assert.match(editor, /if\(clampSelectionToArea\(selection\)\)return;/);
  assert.match(editor, /const area=hfMode\.current\?page\.querySelector<HTMLElement>\(`:scope > \$\{hfMode\.current\}`\):null;/);
  assert.match(editor, /event\.detail<2\)\{const area=\(event\.target as Element\)\.closest\("header,footer"\);if\(area\?hfMode\.current!==area\.tagName\.toLowerCase\(\):hfMode\.current\)\{event\.preventDefault\(\);return\}/);
  assert.match(editor, /hfMode\.current=which;\n  const range=document\.createRange\(\);[\s\S]*?setInsideHeaderFooter\(which\);/);
});

test("a selection can never span the header/footer and the body, and Ctrl+A selects only the area being edited (a triple-click on the header used to merge the first paragraph into it)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const clampSelectionToArea=\(selection:Selection\)=>\{/);
  assert.match(editor, /key==="a"&&!\(document\.activeElement as Element\|null\)\?\.closest\?\.\("td,th"\)&&editor\.current\)\{/);
});

test("gallery headers use Word's placeholders: [Type here] is selected on insert and on one click, so typing replaces it whole", async () => {
  const gallery = await read("lib/word-insert-gallery.ts");
  assert.match(gallery, /const ph = \(text: string\) => `<span data-placeholder="true">\$\{text\}<\/span>`;/);
  assert.match(gallery, /\{ name: "Blank", preview: "blank", html: ph\("\[Type here\]"\) \}/);
  const editor = await read(EDITOR);
  assert.match(editor, /const placeholder=target\.querySelector\("\[data-placeholder\]"\);if\(placeholder\)range\.selectNode\(placeholder\)/);
  assert.match(editor, /const placeholder=\(event\.target as Element\)\.closest\("\[data-placeholder\]"\);if\(placeholder&&event\.detail<2\)/);
});
