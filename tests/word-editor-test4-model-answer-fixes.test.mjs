import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Problems the admin found solving Hindi EFFICIENCY TEST 4's model answer (2026-11-01):
// - Drop Cap on paragraph 4 (a numbered paragraph after Q2) made every save fail: the database refused
//   dropCap on a list item. Drop Cap also only ever dropped one letter (Word drops a selected first word).
// - The footer sat right after the text, in the middle of the page; the header pushed the body down.
// - A paragraph that did not fit at the bottom of a page moved whole to the next one (Word splits it).
// - Page Color was saved but never shown (the sheets were painted white over it).
// - The Font dialog's colour drop-downs had 11 colours; Page Color as a dialog had 6 pastel ones.
// - The Borders button always drew the default teal line, whatever Borders and Shading last used.

const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const run = (overrides = {}) => ({ text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides });
const pageLayout = { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null };
const doc = (blocks) => ({ schemaVersion: "2", blocks, pageLayout, operations: [], savedAt: new Date().toISOString() });

// A top-level function of the editor, compiled to JavaScript so it can run here.
async function editorFunction(name) {
  const source = await read(EDITOR);
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0, index = source.indexOf("{", source.indexOf(")", start));
  for (; index < source.length; index++) { if (source[index] === "{") depth++; else if (source[index] === "}" && --depth === 0) break; }
  const js = ts.transpileModule(source.slice(start, index + 1), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(`${js}; return ${name};`)();
}

test("a drop cap on a numbered paragraph is a valid document, and the database accepts it too", async () => {
  const item = { id: "block-3", type: "list-item", alignment: "left", runs: [run({ text: "Reading", fontSize: 24 }), run({ text: " is easier", fontSize: 12 })], attrs: { listStyle: "decimal", dropCap: true, dropCapLines: 2, dropCapDistance: 0 } };
  assert.doesNotThrow(() => validateWordEditorDocument(doc([item])));

  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    -- the check before this migration: no drop cap attributes on a list item, as on live
    create function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb) returns void language plpgsql as $$
    begin if exists(select 1 from jsonb_array_elements(document_snapshot->'blocks') b where b->>'type'='list-item' and (b->'attrs') ?| array['dropCap','dropCapLines','dropCapDistance','dropCapMargin']) then raise exception 'Unknown block attribute'; end if; end $$;`);
  await db.exec(await read("supabase/migrations/202611012000_word_efficiency_list_item_drop_cap.sql"));
  await db.exec(await read("supabase/migrations/202611012000_word_efficiency_list_item_drop_cap.sql")); // safe to run twice
  const check = (document) => db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(document)]);
  await check(doc([item]));
  await assert.rejects(check(doc([{ ...item, attrs: { ...item.attrs, dropCapLines: 11 } }])), /Invalid drop cap lines/);
  await assert.rejects(check(doc([{ ...item, attrs: { ...item.attrs, dropCap: "yes" } }])), /Invalid dropCap attribute/);
  await db.close();
});

test("Drop Cap drops a selected first word, and a saved dropped word comes back whole", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /capLength=dropCapSelectionLength\(block,editorRange\(\),first\)/);
  assert.match(editor, /applyDropCapMarker\(html,lines,distance,margin,savedDropCapLength\(block\.runs\)\)/);
  const savedDropCapLength = await editorFunction("savedDropCapLength");
  assert.equal(savedDropCapLength([{ text: "Reading", fontSize: 24 }, { text: " is easier", fontSize: 12 }]), 7);
  assert.equal(savedDropCapLength([{ text: "R", fontSize: 36 }, { text: "eading", fontSize: 12 }]), 1);
  // a first run that is simply a formatted word is not a dropped word
  assert.equal(savedDropCapLength([{ text: "Reading", fontSize: 12 }, { text: " is easier", fontSize: 12 }]), 1);
  assert.equal(savedDropCapLength([{ text: "Reading is", fontSize: 24 }, { text: " easier", fontSize: 12 }]), 1);
  assert.equal(savedDropCapLength([{ text: "Reading", fontSize: 24 }]), 1);
});

test("the header and footer sit at Word's 0.5 inch from the top and bottom of every page", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.match(css, /\.word-document-page > header\[data-block-type="header"\], \.word-document-page > footer\[data-block-type="footer"\] \{ position: absolute !important; left: var\(--word-margin-left, 96px\); right: var\(--word-margin-right, 96px\); margin: 0 !important; \}/);
  assert.match(css, /\.word-document-page > footer\[data-block-type="footer"\] \{ top: var\(--word-footer-top, auto\); \}/);
  assert.match(editor, /const HEADER_FOOTER_DISTANCE_PX = 48;/);
  assert.match(editor, /const footerTop = sheetHeight - HEADER_FOOTER_DISTANCE_PX - height\(footer\);/);
  // the body runs between them, and the other pages show copies with their own page numbers
  assert.match(editor, /const bodyTop = Math\.max\(padTop, header \? HEADER_FOOTER_DISTANCE_PX \+ height\(header\) \+ 6 : 0\);/);
  assert.match(editor, /drawHeaderFooterCopies\(page, sheets, step, zoom\);/);
  assert.match(editor, /field\.textContent = \(field\.textContent \?\? ""\)\.replace\(\/\\d\+\/, value => String\(Number\(value\) \+ sheet\)\)/);
  // double-clicking the top or bottom margin of any page opens the header or footer
  assert.match(editor, /const y=\(\(event\.clientY-page\.getBoundingClientRect\(\)\.top\)\/zoomScale\)%stepPx;if\(y<bodyTop\)/);
});

test("a paragraph that does not fit at the bottom of a page is split between its lines, never in the saved text", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if \(\(block\.tagName === "P" \|\| block\.tagName === "LI"\) && splitBetweenSheets\(block, \{ top, zoom, step, bodyTop, bodyBottom \}\)\) continue;/);
  // Widow/Orphan control and a drop cap's lines stay together
  assert.match(editor, /if \(lines\.length - at < 2\) at = lines\.length - 2;/);
  assert.match(editor, /if \(at - firstOnSheet < 2 \|\| at < capLines\)/);
  // the spacer is layout only: removed before every layout and from the undo history
  assert.match(editor, /spacer\.dataset\.pageSplit = "true"; spacer\.contentEditable = "false";/);
  assert.match(editor, /clearPageSplits\(page\);\n  page\.style\.setProperty\("--word-page-color"/);
  assert.match(editor, /const clone=page\.cloneNode\(true\)as HTMLElement;clearPageSplits\(clone\);/);
  // Backspace / Delete beside it delete one character
  assert.match(editor, /deleteBesidePageSplit\(event\.key==="Delete"\)\)\{event\.preventDefault\(\);typingEdit\.current=true;changed\(\);return\}/);
});

test("Page Color colours every page", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.match(css, /repeating-linear-gradient\(to bottom, var\(--word-page-color, #fff\) 0, var\(--word-page-color, #fff\) var\(--word-page-height, 1123px\)/);
  assert.match(editor, /page\.style\.setProperty\("--word-page-color", page\.style\.backgroundColor \|\| "#fff"\);/);
  assert.doesNotMatch(editor, /SAFE_PAGE_COLORS/);
});

test("every colour drop-down in the dialogs opens Word's full palette", async () => {
  const [dialogs, editor] = await Promise.all([read("components/word-efficiency/word-2013-dialogs.tsx"), read(EDITOR)]);
  const select = dialogs.slice(dialogs.indexOf("function ColorSelect13("), dialogs.indexOf("const UNDERLINE_CHOICES"));
  assert.match(select, /<WordPalette noneLabel=\{autoLabel\} noneSwatch="#000"/);
  assert.doesNotMatch(dialogs, /COLOR_CHOICES/);
  assert.doesNotMatch(editor, /ColorSwatchField|SAFE_COLORS/);
  assert.match(editor, /function ColorForm\(.*?=>void\}\)\{return <div><h3 className="font-black">\{label\}<\/h3><div className="mt-3"><WordPalette noneLabel="No Color"/);
});

test("the Borders button draws the line last chosen in Borders and Shading, and some sides keep it when saved", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(values\.setting!=="none"\)lastBorderLine\.current=css;/);
  assert.match(editor, /if\(line&&\(value==="all"\|\|value==="outside"\)\)\{setBlockBorderSides\(block,\[\.\.\.BORDER_SIDES\],line\);continue\}/);
  const pattern = new RegExp(editor.match(/const CUSTOM_BORDER_SIDES=\/(.+)\/;/)[1]);
  assert.deepEqual([..."4px solid #FF0000 sides:bottom,left".match(pattern)].slice(1), ["4px solid #FF0000", "bottom,left"]);
  assert.equal(pattern.test("bottom,left"), false);
  const paragraph = { id: "block-0", type: "paragraph", alignment: "left", runs: [run()], attrs: { lineNumbers: false, dropCap: false, border: "4px solid #FF0000 sides:bottom,left" } };
  assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph])));
});

test("Underline (and every run format) over several selected paragraphs reaches each of them, only under their text", async () => {
  const { Window } = await import("happy-dom");
  const { wrapEditorRange } = await import("../lib/word-editor-dom.ts");
  const document = new Window().document;
  document.body.innerHTML = '<div id="editor"><ol><li id="a"><span>Alpha one</span></li><li id="b"><span>Beta two</span></li><li id="c"><span>Gamma three</span></li></ol><p id="d">Delta</p></div>';
  const text = id => document.querySelector(`#${id}`).querySelector("span")?.firstChild ?? document.querySelector(`#${id}`).firstChild;
  const range = document.createRange();
  range.setStart(text("a"), 6); range.setEnd(text("c"), 5);
  const wrapped = wrapEditorRange(range, { textDecorationLine: "underline" }, { underlineStyle: "single" });
  assert.deepEqual(wrapped.spans.map(span => span.textContent), ["one", "Beta two", "Gamma"]);
  assert.deepEqual(wrapped.spans.map(span => span.parentElement.closest("li").id), ["a", "b", "c"]);
  assert.equal(document.querySelectorAll("li").length, 3);
  assert.equal(document.querySelector("#editor").textContent, "Alpha oneBeta twoGamma threeDelta");
  // a triple-click selection that ends at the start of the next paragraph does not reach into it
  const triple = document.createRange();
  triple.setStart(document.querySelector("#c"), 0); triple.setEnd(document.querySelector("#d").firstChild, 0);
  const one = wrapEditorRange(triple, { fontWeight: "700" });
  assert.equal(one.spans.length, 1);
  assert.equal(document.querySelector("#d").innerHTML, "Delta");
});

test("each page is drawn at its paper's width (A4 when no size was chosen), and saved documents keep no size they did not choose", async () => {
  const editor = (await read(EDITOR)).replace(/\r\n/g, "\n");
  assert.match(editor, /const paperWidth=el\.style\.maxWidth\|\|`\$\{PAPER_WIDTH_PX\.a4\}px`;if\(el\.style\.width!==paperWidth\)el\.style\.width=paperWidth;/);
  // the page never shrinks to the window (Word keeps the paper's size and scrolls)
  assert.match(editor, /w-\[794px\] max-w-none shrink-0 bg-white/);
  assert.doesNotMatch(editor, /w-\[794px\] max-w-full/);
  // an unchosen size stays unsaved (rules check only chosen sizes such as A3 "42 \/ 29.7")
  assert.match(editor, /maxWidth:editor\.style\.maxWidth\|\|null,aspectRatio:editor\.style\.aspectRatio\|\|null/);
});

test("the header/footer copies on later pages never show the editing line", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.match(editor.replace(/\r\n/g, "\n"), /copy\.style\.border = "0";[\s\S]{0,200}copy\.removeAttribute\("class"\);/);
  assert.match(css, /\.word-hf-copy > header, \.word-hf-copy > footer \{ border: 0 !important; \}/);
});

test("a bordered or shaded paragraph split between pages closes its border on page 1 and reopens it on page 2, never across the gap or the header", async () => {
  const editor = (await read(EDITOR)).replace(/\r\n/g, "\n");
  assert.match(editor, /paintSplitSpacer\(block, spacer, sheet, number\);\n    split = true;/);
  const paint = editor.slice(editor.indexOf("function paintSplitSpacer("), editor.indexOf("// The header and the footer on every sheet after the first:"));
  // the spacer reaches over the padding and side borders, and paints paper, grey gap, paper
  assert.match(paint, /spacer\.style\.marginLeft = `-\$\{px\(style\.paddingLeft\) \+ \(left\?\.width \?\? 0\)\}px`;/);
  assert.match(paint, /#d4d4d4 \$\{paperEnd\}px \$\{gapEnd\}px/);
  // the bottom line closes page 1's part at the spacer's top, the top line opens page 2's part at its bottom
  assert.match(paint, /if \(bottom\) \{[^\n]*?positions\.push\("0 0"\); \}/);
  assert.match(paint, /if \(top\) \{[^\n]*?positions\.push\("0 100%"\); \}/);
  // a paragraph with no border and no shading keeps a plain spacer
  assert.match(paint, /if \(!top && !bottom && !left && !right && !shaded\) return;/);
});
