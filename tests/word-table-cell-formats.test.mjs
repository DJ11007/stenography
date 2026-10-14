import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { PGlite } from "@electric-sql/pglite";
import { wrapEditorRange } from "../lib/word-editor-dom.ts";
import { diffWordDocuments, modelAnswerRuleCriteria } from "../lib/word-document-diff.ts";
import { validCellFormats } from "../lib/word-table-format.ts";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Real reported need: EFFICIENCY TEST 2's Q5 formats a table ("first column
// font size 10", "third row Top Centre", "second row double strikethrough").
// A saved table kept only cell text, so none of it survived a submit.

function tableDocument() {
  const window = new Window(), document = window.document;
  document.body.innerHTML = '<div id="editor" contenteditable="true"><p id="p1">Before</p><table><tbody><tr><td id="a1">A1</td><td id="b1">B1</td></tr><tr><td id="a2">A2</td><td id="b2">B2</td></tr></tbody></table></div>';
  return { document, editor: document.querySelector("#editor") };
}

test("formatting a selection that spans table cells wraps each cell separately and never moves text between cells", () => {
  const { document, editor } = tableDocument();
  const range = document.createRange();
  range.setStart(document.querySelector("#a2").firstChild, 0);
  range.setEnd(document.querySelector("#b2").firstChild, 2);
  const wrapped = wrapEditorRange(range, { fontSize: "10pt" });
  assert.ok(wrapped);
  assert.equal(wrapped.spans.length, 2);
  assert.equal(editor.querySelectorAll("td").length, 4, "no cell lost");
  assert.equal(document.querySelector("#a2").textContent, "A2");
  assert.equal(document.querySelector("#b2").textContent, "B2");
  assert.equal(document.querySelector("#a2 span").style.fontSize, "10pt");
  assert.equal(document.querySelector("#b2 span").style.fontSize, "10pt");
  assert.equal(document.querySelector("#a1 span"), null, "row 1 untouched");
});

test("a selection inside one cell still wraps just that text, as before", () => {
  const { document } = tableDocument();
  const range = document.createRange();
  range.setStart(document.querySelector("#a1").firstChild, 0);
  range.setEnd(document.querySelector("#a1").firstChild, 1);
  const wrapped = wrapEditorRange(range, { fontWeight: "700" });
  assert.equal(wrapped.spans.length, 1);
  assert.equal(document.querySelector("#a1").textContent, "A1");
});

const doc = (blocks) => ({ schemaVersion: "2", blocks, pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null }, operations: [], savedAt: "2026-10-15T00:00:00.000Z" });
const emptyRun = { text: "", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null };
const table = (cellFormats) => ({ id: "t", type: "table", alignment: "left", runs: [emptyRun], attrs: { rows: [["A1", "B1"], ["A2", "B2"], ["A3", "B3"]], ...(cellFormats ? { cellFormats } : {}) } });
const plain = () => [[{ fontSize: 12 }, { fontSize: 12 }], [{ fontSize: 12 }, { fontSize: 12 }], [{ fontSize: 12 }, { fontSize: 12 }]];

test("the Model Answer rule builder turns changed cell formatting into one criterion per cell and field", () => {
  const after = plain();
  after[0][0].fontSize = 10; after[1][0].fontSize = 10; after[2][0].fontSize = 10;
  after[1][0].doubleStrike = true; after[1][1].doubleStrike = true;
  after[2][0].align = "center"; after[2][0].valign = "top"; after[2][1].align = "center"; after[2][1].valign = "top";
  const targets = diffWordDocuments(doc([table(plain())]), doc([table(after)])).map((change) => `${change.target}=${JSON.stringify(change.expectedValue)}`).sort();
  assert.deepEqual(targets, [
    "blocks.0.attrs.cellFormats.0.0.fontSize=10", "blocks.0.attrs.cellFormats.1.0.doubleStrike=true", "blocks.0.attrs.cellFormats.1.0.fontSize=10",
    "blocks.0.attrs.cellFormats.1.1.doubleStrike=true", "blocks.0.attrs.cellFormats.2.0.align=\"center\"", "blocks.0.attrs.cellFormats.2.0.fontSize=10",
    "blocks.0.attrs.cellFormats.2.0.valign=\"top\"", "blocks.0.attrs.cellFormats.2.1.align=\"center\"", "blocks.0.attrs.cellFormats.2.1.valign=\"top\"",
  ]);
  const criteria = modelAnswerRuleCriteria(doc([table(after)]), [{ target: "blocks.0.attrs.cellFormats.1.0.doubleStrike", savedValue: true }]);
  assert.deepEqual(criteria.map((criterion) => criterion.expectedValue), [true]);
});

test("cell formatting is validated on the client: shape must match the table, fields must be known", () => {
  assert.equal(validCellFormats(plain(), table().attrs.rows), true);
  assert.equal(validCellFormats([[{ fontSize: 12 }]], table().attrs.rows), false, "row count must match");
  assert.equal(validCellFormats([[{ wobble: true }, null], [null, null], [null, null]], table().attrs.rows), false);
  assert.doesNotThrow(() => validateWordEditorDocument(doc([table(plain())])));
  assert.throws(() => validateWordEditorDocument(doc([table([[{ align: "sideways" }, null], [null, null], [null, null]])])));
});

const migrations = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql",
  "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql",
  "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));
const cellMigration = new URL("../supabase/migrations/202610151000_word_efficiency_table_cell_formats.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth; create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create role anon; create role authenticated;
create table public.profiles(id uuid primary key);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select false$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb) returns jsonb language sql immutable as $$select c$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_capability_changes(d jsonb, b jsonb, c jsonb) returns void language plpgsql immutable as $$begin end $$;
-- The previous schema check: it knows nothing of cellFormats and rejects it, as the real one does.
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$
begin if exists(select 1 from jsonb_array_elements(d->'blocks') b where b.value->'attrs' ? 'cellFormats') then raise exception 'Invalid table attributes'; end if; end $$;
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid, auto_publish_results boolean default false);
create table public.word_efficiency_versions(id uuid primary key, model_answer_snapshot jsonb, passing_marks numeric);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, marks numeric);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, result jsonb, final_document_snapshot jsonb, evaluated_by uuid);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric, awarded_marks numeric, graded_by uuid);
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb);
`);
  for (const migration of migrations) await db.exec(await readFile(migration, "utf8"));
  await db.exec(await readFile(cellMigration, "utf8"));
  return db;
}

test("the server accepts saved cell formatting (and hands the older check a document without it), and rejects malformed formatting", async () => {
  const db = await database();
  const formats = plain(); formats[1][0].doubleStrike = true;
  await db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table(formats)]))]);
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table([[{ align: "sideways" }, null], [null, null], [null, null]])]))]), /Invalid table cell formatting/);
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table([[null, null]])]))]), /Invalid table cell formatting/);
  // Running the migration a second time changes nothing.
  await db.exec(await readFile(cellMigration, "utf8"));
  await db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table(formats)]))]);
});

test("a v2 grading rule on table cell formatting awards marks only when those cells are formatted", async () => {
  const db = await database();
  const criteria = [
    { target: "blocks.0.attrs.cellFormats.0.0.fontSize", expectedValue: 10 },
    { target: "blocks.0.attrs.cellFormats.1.0.fontSize", expectedValue: 10 },
    { target: "blocks.0.attrs.cellFormats.2.0.fontSize", expectedValue: 10 },
  ];
  const marks = async (formats) => (await db.query("select public.evaluate_word_efficiency_grading_rule($1::jsonb,'blocks.0.attrs.cellFormats.0.0.fontSize','model-answer-match-v2','10'::jsonb,5,null,$2::jsonb,null)::float as m", [JSON.stringify(doc([{ id: "p", type: "paragraph", alignment: "left", runs: [{ text: "Intro" }], attrs: {} }, table(formats)].slice(1))), JSON.stringify(criteria)])).rows[0].m;
  const firstColumn = plain(); for (const row of firstColumn) row[0].fontSize = 10;
  assert.equal(await marks(firstColumn), 5);
  const twoOnly = plain(); twoOnly[0][0].fontSize = 10; twoOnly[1][0].fontSize = 10;
  assert.equal(await marks(twoOnly), 0);
  assert.equal(await marks(plain()), 0);
});
