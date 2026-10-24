import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// EFFICIENCY TEST 4 (Hindi paragraphs in Kruti Dev 010) is marked by rule criteria, including the
// list and table rules of migration 202610241000. This runs my attempt, saved from the real editor
// after doing every question the Word 2013 way, and changed copies of it through the real SQL marking.

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
  "202610241000_word_efficiency_list_and_table_rules.sql",
  "202610241010_word_efficiency_test4_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "6632c423-d16f-4a4b-a600-47b0aecb7bea", testId = "b7527861-8e1f-465d-99f0-2dface4d2c07";
const QUESTIONS = [
  ["442210ab-cdaf-45f5-b117-aaab60e1d839", 5], ["2ea44dd2-f7ca-4bcf-bfd1-e828da822819", 5], ["920a33fe-35fa-438e-a1b2-b1bc87b073c1", 5],
  ["f5b19fe9-ab60-4eaf-88a8-890ed87e7eca", 5], ["728649f0-bf1e-453e-8635-a6c139b0028f", 5],
];
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("word-efficiency-test4-model.json"), initial = await read("word-efficiency-test4-initial.json");
const clone = (value) => JSON.parse(JSON.stringify(value));
const block = (doc, type) => doc.blocks.find((b) => b.type === type);
const body = (doc, place) => doc.blocks.filter((b) => !["header", "footer"].includes(b.type))[place];
const rows = (doc) => block(doc, "table").attrs;

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
insert into public.word_efficiency_versions values('${version}','${testId}','EFFICIENCY TEST 4','Hindi',25,10,'{}'::jsonb,null);
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
  const { rows: result } = await database_.query(
    `select q.question_number as n, (public.word_efficiency_score_question($1::jsonb, q.version_id, q.id, q.marks, null)).awarded::float as awarded
     from public.word_efficiency_questions q where q.version_id=$2 order by q.question_number`,
    [JSON.stringify(document), version],
  );
  return Object.fromEntries(result.map((row) => [row.n, row.awarded]));
}
const total = (result) => Object.values(result).reduce((sum, value) => sum + value, 0);

test("my attempt done the Word 2013 way earns 25/25", async () => {
  assert.deepEqual(await marks(model), { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 });
});

test("the untouched paper earns nothing", async () => {
  assert.equal(total(await marks(initial)), 0);
});

test("Q1: a wrong underline colour costs part a only; no outline costs part b; one indent missing costs part c", async () => {
  const colour = clone(model);
  for (const run of body(colour, 0).runs) if (run.underlineStyle === "thick") run.underlineColor = "FF0000";
  assert.equal((await marks(colour))[1], 3);
  const outline = clone(model);
  for (const run of body(outline, 1).runs) run.outline = false;
  assert.equal((await marks(outline))[1], 3.5);
  const indent = clone(model);
  body(indent, 0).attrs.marginRight = "0pt";
  assert.equal((await marks(indent))[1], 3.5);
});

test("Q2: a hanging indent, one missed ukyank, or a yellow highlight each lose their part", async () => {
  const hanging = clone(model);
  body(hanging, 1).attrs.specialIndentMode = "hanging";
  assert.equal((await marks(hanging))[2], 3.5);
  const missed = clone(model);
  const run = body(missed, 3).runs.find((item) => item.text === "ukyank");
  run.underline = false; run.underlineStyle = null; run.underlineColor = null;
  assert.equal((await marks(missed))[2], 3.5);
  const yellow = clone(model);
  for (const item of body(yellow, 2).runs) if (item.text === "lkseokj") item.highlight = "FFFF00";
  assert.equal((await marks(yellow))[2], 3);
  const pink = clone(model);
  for (const item of body(pink, 2).runs) if (item.text === "lkseokj") item.highlight = "FF00FF";
  assert.equal((await marks(pink))[2], 5, "Pink is accepted as purple too");
});

test("Q3: the footer text in the centre position, or the page number on the left, loses that part", async () => {
  const centre = clone(model);
  block(centre, "footer").runs[0].text = "	SAMRADHI CLASSES";
  assert.equal((await marks(centre))[3], 3.5);
  const left = clone(model);
  const field = block(left, "footer").runs[1];
  field.field = "page-number|current|left"; field.text = "1";
  assert.equal((await marks(left))[3], 3);
  const plain3 = clone(model);
  const number = block(plain3, "footer").runs[1];
  number.field = "page-number|bottom|right"; number.text = "1";
  assert.equal((await marks(plain3))[3], 5, "Bottom of Page > Plain Number 3");
});

test("Q4: A3 portrait, a semitransparent watermark, or a one-level list each lose their part", async () => {
  const portrait = clone(model);
  portrait.pageLayout.aspectRatio = "29.7 / 42"; portrait.pageLayout.maxWidth = "1123px";
  assert.equal((await marks(portrait))[4], 3.5);
  const faded = clone(model);
  faded.pageLayout.watermarkSemitransparent = "true";
  assert.equal((await marks(faded))[4], 3.5);
  const latin = clone(model);
  latin.pageLayout.watermarkFont = "Calibri";
  assert.equal((await marks(latin))[4], 3.5, "Kruti Dev keys in Calibri do not show एलडीसी");
  const unicode = clone(model);
  unicode.pageLayout.watermark = "एलडीसी"; unicode.pageLayout.watermarkFont = "Mangal";
  assert.equal((await marks(unicode))[4], 5);
  const flat = clone(model);
  for (const item of flat.blocks) if (item.type === "list-item") item.attrs.listLevel = "1";
  assert.equal((await marks(flat))[4], 3);
});

test("Q5: no new row, an unsorted column, or a black first column each lose their part", async () => {
  const noRow = clone(model);
  rows(noRow).rows.splice(1, 1); rows(noRow).cellFormats.splice(1, 1);
  assert.equal((await marks(noRow))[5], 3.5);
  const unsorted = clone(model);
  const r = rows(unsorted).rows; [r[2], r[10]] = [r[10], r[2]];
  assert.equal((await marks(unsorted))[5], 3.5);
  const black = clone(model);
  for (const row of rows(black).cellFormats.slice(1)) if (row[0].shading) row[0].shading = "000000";
  assert.equal((await marks(black))[5], 3);
});

test("a sorted column that is not all numbers is compared as text (a value like 1a5 is not cast to a number)", async () => {
  const doc = clone(model);
  rows(doc).rows[2][0] = "1a5";
  const result = await marks(doc);
  assert.equal(typeof result[5], "number");
});
