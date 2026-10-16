import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { MARGIN_PRESETS, paddingText, paperFromWidth, parsePadding, renderedPadding } from "../lib/word-page-setup.ts";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";
import { diffWordDocuments } from "../lib/word-document-diff.ts";

// Word 2013 PAGE LAYOUT: margins are saved in mm exactly as before (so existing
// margin answers keep grading), the gutter is its own field, and old answers
// without a gutter stay valid and produce no gutter change.

test("margins round-trip in the saved mm form, and presets match the old values exactly", () => {
  assert.equal(paddingText({ top: 2, right: 2.032, bottom: 2, left: 2 }), "20mm 20.32mm 20mm 20mm", "0.8 inch right margin (EFFICIENCY TEST 2 Q1)");
  assert.deepEqual(parsePadding("20mm 20.32mm 20mm 20mm"), { top: 2, right: 2.032, bottom: 2, left: 2 });
  assert.equal(paddingText(parsePadding("20mm 20.32mm 20mm 20mm")), "20mm 20.32mm 20mm 20mm", "Last Custom Setting re-applies the exact margins");
  assert.equal(paddingText(MARGIN_PRESETS.find(p => p.id === "moderate").margins), "25.4mm 19.1mm 25.4mm 19.1mm");
  assert.equal(paddingText(MARGIN_PRESETS.find(p => p.id === "mirrored").margins), "25.4mm 25.4mm 25.4mm 31.8mm");
  assert.equal(renderedPadding({ top: 2, right: 2, bottom: 2, left: 2 }, 1.27, "left"), "20mm 20mm 20mm 32.7mm", "the gutter only widens the page, not the saved margins");
  assert.equal(paperFromWidth(559).id, "a5");
  assert.equal(paperFromWidth(800), null);
});

const run = { text: "A", bold: false, italic: false, underline: false, underlineStyle: null, underlineColor: null, underlineThickness: null, underlineWordsOnly: false, strike: false, doubleStrike: false, superscript: false, subscript: false, smallCaps: false, allCaps: false, hidden: false, outline: false, emboss: false, fontFamily: "Calibri", fontSize: 11, color: "000000", highlight: null, charScale: null, charSpacing: null, charPosition: null, kerningEnabled: false, kerningMin: null, href: null, bookmark: null, field: null };
const layout = { padding: "20mm 20.32mm 20mm 20mm", maxWidth: "559px", aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null };
const doc = (pageLayout) => ({ schemaVersion: "2", blocks: [{ id: "p", type: "paragraph", alignment: "left", runs: [run], attrs: {} }], pageLayout, operations: [], savedAt: "2026-10-16T00:00:00.000Z" });

test("the gutter is optional, validated, and graded as its own change", () => {
  validateWordEditorDocument(doc(layout));
  validateWordEditorDocument(doc({ ...layout, gutter: "12.7mm", gutterPosition: "left" }));
  validateWordEditorDocument(doc({ ...layout, gutter: null, gutterPosition: null }));
  assert.throws(() => validateWordEditorDocument(doc({ ...layout, gutter: "half an inch" })));
  assert.throws(() => validateWordEditorDocument(doc({ ...layout, gutterPosition: "right" })));
  assert.deepEqual(diffWordDocuments(doc(layout), doc({ ...layout, gutter: null, gutterPosition: null })).map(c => c.target), [], "missing and null are the same");
  const targets = diffWordDocuments(doc(layout), doc({ ...layout, gutter: "12.7mm", gutterPosition: "left" })).map(c => c.target);
  assert.ok(targets.includes("pageLayout.gutter") && targets.includes("pageLayout.gutterPosition"), targets.join(", "));
});

test("the server accepts the gutter fields and refuses malformed ones", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$
begin if exists(select 1 from jsonb_object_keys(d->'pageLayout') k where k not in('padding','maxWidth','aspectRatio','columnCount','backgroundColor','border','watermark')) then raise exception 'Invalid page layout fields'; end if; end $$;`);
  const migration = await readFile(new URL("../supabase/migrations/202610161400_word_efficiency_page_setup_gutter.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration);
  const check = (pageLayout) => db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc(pageLayout))]);
  await check(layout);
  await check({ ...layout, gutter: "12.7mm", gutterPosition: "top" });
  await check({ ...layout, gutter: null, gutterPosition: null });
  await assert.rejects(check({ ...layout, gutter: "12.7cm" }), /Invalid page gutter/);
  await assert.rejects(check({ ...layout, gutterPosition: "right" }), /Invalid page gutter position/);
  await assert.rejects(check({ ...layout, colour: "red" }), /Invalid page layout fields/, "other fields still go to the older check");
});

test("a reopened answer gets its page settings back, and the saved margins never include the gutter", async () => {
  const source = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
  assert.match(source, /function renderStructuredSnapshot\(editor:HTMLDivElement\|null,snapshot:ReturnType<typeof toSnapshot>\)\{renderSnapshot\(editor,snapshot\);if\(!editor\)return;applySavedPageLayout\(editor,snapshot\.pageLayout\);/);
  assert.match(source, /pageLayout:\{padding:editor\.dataset\.margins\|\|editor\.style\.padding\|\|null,gutter:/);
  // Custom Margins… opens Word's Page Setup dialog, not the old millimetre form.
  assert.match(source, /if\(id==="marginsAction"\)\{if\(value==="custom"\)openPageSetup\("margins"\);return\}/);
});
