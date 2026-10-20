import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// EFFICIENCY TEST 3 is marked by rule criteria (migration 202610201200): "every word", "every
// occurrence", "the whole column". This runs the admin's model answer (saved from the real editor,
// one save per question) and changed copies of it through the real SQL marking.

const migrations = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql",
  "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql",
  "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql",
  "202610151200_word_efficiency_rules_block_kind.sql",
  "202610181500_word_efficiency_part_marks.sql",
  "202610191200_word_efficiency_words_only_runs.sql",
  "202610191300_word_efficiency_page_border_sides.sql",
  "202610191900_word_efficiency_nbsp_equals_space.sql",
  "202610201200_word_efficiency_rule_criteria.sql",
  "202610201210_word_efficiency_test3_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b", testId = "a0f4877c-61f1-4c5d-8f2c-a02d58324192";
const QUESTIONS = [
  ["07c2914f-917e-48a9-a3bd-b89637fd79ad", 1], ["987386e5-b31c-4356-bbe1-252d8ad46a1b", 1], ["81d6c884-1688-4dc5-9fa1-2dc55030bd6f", 1],
  ["f3876018-a66b-4ca5-aea4-518bef6461a0", 1], ["0db67773-6e96-4fc6-8ad6-518151d7a17f", 1], ["79375d7a-1773-49b0-8a7c-06b570f4de6a", 2],
  ["6299d0d7-4f03-45bd-8cdf-ed8b6d42af0f", 2], ["104cf337-1d8e-45a3-b143-20b6bdca5984", 2], ["7d4d951f-e844-47b9-a8de-e4fae53ee600", 2],
  ["503c62fa-6523-401f-8e0f-d0571b9cc3d6", 2], ["b823b410-f89f-4e6c-be8c-8b30e1093342", 2], ["be82f2b7-f778-4dd9-a52d-f50eea5a7780", 2],
  ["ef970bc0-4205-42b1-aa4b-3b42fd9fda5d", 2], ["7065de29-b35e-47d6-ab2d-4d97b3efcf20", 2], ["abf7a79b-d8d8-4d38-a29f-e4ccf4473872", 2],
];
const model = JSON.parse(await readFile(new URL("./fixtures/word-efficiency-test3-model.json", import.meta.url), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const block = (doc, type) => doc.blocks.find((b) => b.type === type);
const body = (doc, place) => doc.blocks.filter((b) => !["header", "footer"].includes(b.type))[place];
const table = (doc) => block(doc, "table").attrs;

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid, admin boolean);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, role text, is_active boolean, full_name text, email text);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select false$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select false$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb) returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb, baseline jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid);
create table public.word_efficiency_versions(id uuid primary key, test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, instruction text, display_order int, marks numeric);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, selected_duration_seconds int, started_at timestamptz, snapshot jsonb, result jsonb, submitted_at timestamptz, updated_at timestamptz, original_document_snapshot jsonb, final_document_snapshot jsonb, document_autosave jsonb, evaluation_status text, evaluated_at timestamptz, evaluated_by uuid, result_published_at timestamptz);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, graded_at timestamptz, updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb, created_at timestamptz default now());
insert into public.word_efficiency_tests values('${testId}','${version}');
insert into public.word_efficiency_versions values('${version}','${testId}','EFFICIENCY TEST 3','English',25,10,'{}'::jsonb,null);
insert into public.word_efficiency_questions(id,version_id,question_number,display_order,marks) values ${QUESTIONS.map(([id, marks], index) => `('${id}','${version}',${index + 1},${index + 1},${marks})`).join(",")};
`);
  for (const migration of migrations.slice(0, -1)) await db.exec(await readFile(migration, "utf8"));
  // The live table's shape check (migration 202608280039), so the rules must pass it to be saved.
  await db.exec(`
create function public.valid_additional_criteria_shape(criteria jsonb) returns boolean language plpgsql immutable as $$
begin perform public.assert_word_efficiency_additional_criteria(criteria); return true; exception when others then return false; end $$;
alter table public.word_efficiency_grading_rules add constraint shape check (public.valid_additional_criteria_shape(additional_criteria));`);
  await db.exec(await readFile(migrations.at(-1), "utf8"));
  return db;
}

async function marks(document) {
  const database_ = await database();
  const { rows } = await database_.query(
    `select q.question_number as n, (public.word_efficiency_score_question($1::jsonb, q.version_id, q.id, q.marks, null)).awarded::float as awarded
     from public.word_efficiency_questions q where q.version_id=$2 order by q.question_number`,
    [JSON.stringify(document), version],
  );
  return Object.fromEntries(rows.map((row) => [row.n, row.awarded]));
}
const full = Object.fromEntries(QUESTIONS.map(([, value], index) => [index + 1, value]));
const total = (result) => Object.values(result).reduce((sum, value) => sum + value, 0);

test("the model answer earns 25/25, and every question has a rule", async () => {
  const result = await marks(model);
  assert.deepEqual(result, full);
  assert.equal(total(result), 25);
});

test("the untouched paper earns nothing", async () => {
  const blank = clone(model);
  blank.blocks = blank.blocks.filter((b) => !["header", "footer"].includes(b.type)).map((b) => ({ ...b, attrs: b.type === "table" ? { rows: b.attrs.rows.map((row) => row.slice(0, 4)) } : { marginLeft: "0pt" }, runs: b.runs.map((run) => ({ text: run.text.replace(/punjab/gi, "rajasthan"), fontFamily: "Segoe UI", fontSize: 12, color: "020618" })) }));
  blank.pageLayout = { padding: "25.4mm 25.4mm 25.4mm 25.4mm", maxWidth: "794px", aspectRatio: "1 / 1.414" };
  assert.equal(total(await marks(blank)), 0);
});

test("Q1 words only: a highlighted space or an unhighlighted word loses the mark", async () => {
  const spaces = clone(model);
  body(spaces, 0).runs[1].highlight = "00FFFF";
  assert.equal((await marks(spaces))[1], 0);
  const missed = clone(model);
  body(missed, 0).runs[4].highlight = null;
  assert.equal((await marks(missed))[1], 0);
});

test("Q2 accepts a red underline on the words with the spaces left plain", async () => {
  const doc = clone(model);
  const p2 = body(doc, 1);
  const [first, ajay] = p2.runs;
  p2.runs = [...first.text.split(/(\s+)/).filter(Boolean).map((text) => (/\s/.test(text) ? { text } : { text, underline: true, underlineStyle: "single", underlineColor: "FF0000" })), ajay];
  assert.equal((await marks(doc))[2], 1);
});

test("Q4 part marks: wrong indent keeps the condensed half", async () => {
  const doc = clone(model);
  body(doc, 0).attrs.marginLeft = "72pt";
  assert.equal((await marks(doc))[4], 0.5);
});

test("Q5 counts every 'Ajay sir', however the runs are split", async () => {
  const split = clone(model);
  const p4 = body(split, 3), at = p4.runs.findIndex((run) => run.text === "Ajay sir");
  p4.runs.splice(at, 1, { ...p4.runs[at], text: "Ajay" }, { ...p4.runs[at], text: " sir" });
  assert.equal((await marks(split))[5], 1);
  const missed = clone(model);
  const p5 = body(missed, 4);
  p5.runs.find((run) => run.text === "ajay sir").highlight = null;
  assert.equal((await marks(missed))[5], 0);
});

test("Q6: a 'rajasthan' left behind loses the replace part", async () => {
  const doc = clone(model);
  const run = body(doc, 2).runs.find((r) => r.text === "punjab");
  Object.assign(run, { text: "rajasthan", fontSize: 12, color: "020618" });
  assert.equal((await marks(doc))[6], 0);
  const capital = clone(model);
  for (const r of body(capital, 2).runs) if (/punjab/i.test(r.text)) r.text = "Punjab";
  assert.equal((await marks(capital))[6], 2);
});

test("Q7 without a header scores 0 and the paragraphs still find their own questions", async () => {
  const doc = clone(model);
  doc.blocks = doc.blocks.filter((b) => b.type !== "header");
  const result = await marks(doc);
  assert.equal(result[7], 0);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => result[n]), [1, 1, 1, 1, 1, 2]);
});

test("Q8/Q9: Plain Number 3 alone replaces the footer -- the page number counts, the date does not (as in Word)", async () => {
  const doc = clone(model);
  block(doc, "footer").runs = [{ text: "1", field: "page-number|bottom|right" }];
  const result = await marks(doc);
  assert.equal(result[8], 0);
  assert.equal(result[9], 2);
  const leftNumber = clone(model);
  block(leftNumber, "footer").runs[1].field = "page-number|current|left";
  assert.equal((await marks(leftNumber))[9], 1);
  const shortDate = clone(model);
  block(shortDate, "footer").runs[0].text = "10/20/2026";
  assert.equal((await marks(shortDate))[8], 1);
});

test("Q10-Q12 page layout: typed Moderate margins, a double wave border, and all-four-sides borders", async () => {
  const typed = clone(model);
  typed.pageLayout.padding = "25.4mm 19.05mm 25.4mm 19.05mm";
  typed.pageLayout.border = "1px doubleWave #00B050 sides:top,bottom";
  const result = await marks(typed);
  assert.equal(result[10], 2);
  assert.equal(result[12], 2);
  const box = clone(model);
  box.pageLayout.border = "1px wave #00B050";
  assert.equal((await marks(box))[12], 1);
  const letter = clone(model);
  letter.pageLayout.aspectRatio = "21.59 / 27.94";
  assert.equal((await marks(letter))[11], 0);
});

test("Q13-Q15 table: one top-aligned cell, a column inserted on the wrong side, a black column", async () => {
  const top = clone(model);
  table(top).cellFormats[2][1].valign = "top";
  assert.equal((await marks(top))[13], 1);
  const left = clone(model);
  for (const [r, row] of table(left).rows.entries()) { row.splice(3, 0, row.pop()); table(left).cellFormats[r].splice(3, 0, table(left).cellFormats[r].pop()); }
  const result = await marks(left);
  assert.equal(result[14], 1, "AutoFit still counts; the column is in the wrong place");
  assert.equal(result[15], 2, "the CITY column is found by its heading");
  const black = clone(model);
  table(black).cellFormats[3][3].color = "020618";
  assert.equal((await marks(black))[15], 0);
});

test("the shape check takes known rules only", async () => {
  const database_ = await database();
  const valid = async (criteria) => (await database_.query("select public.valid_additional_criteria_shape($1::jsonb) as ok", [JSON.stringify(criteria)])).rows[0].ok;
  assert.equal((await database_.query("select count(*)::int as n from public.word_efficiency_grading_rules")).rows[0].n, 24);
  assert.equal(await valid([{ rule: "words", kind: "body", place: 0, props: { bold: [true] } }]), true);
  assert.equal(await valid([{ target: "blocks.0.runs.0.bold", expectedValue: true }]), true);
  assert.equal(await valid([{ rule: "script", props: {} }]), false);
  assert.equal(await valid([{ rule: "words", sql: "drop" }]), false);
  assert.equal(await valid([{ rule: "anyOf", criteria: [{ rule: "nope" }] }]), false);
  assert.equal(await valid([{ rule: "text", find: "x".repeat(5000) }]), false);
});
