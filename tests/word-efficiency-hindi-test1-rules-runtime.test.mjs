import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi EFFICIENCY TEST 1 (15 questions in Hindi, working document in Kruti Dev 010) is marked by rule
// criteria. This runs my attempt, saved from the real editor after doing every question the Word 2013
// way, and changed copies of it through the real SQL marking.

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
  "202610241100_word_efficiency_hindi_test1_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "69dbc0f2-9055-41d3-a88b-44a65d8f33c5", testId = "b7527861-8e1f-465d-99f0-2dface4d2c07";
const QUESTIONS = [["4dc8e113-9170-4d04-adbe-d83184b3ea27",1.66],["9b6d1e93-f5ec-4722-9376-d990f847056e",1.66],["b39277b7-44e8-4be2-942b-9cedfd2f70b2",1.66],["f5f2aaa0-52bc-42de-8e84-8b761ba0eabc",1.66],["981b99d2-33b1-4dcd-9d1a-7c9b1427d8c5",1.66],["8b16befa-0e0e-4bb6-9735-3a1ed1ba77d5",1.66],["3542d2c2-d7ee-47e2-96e7-d3738a0fcd49",1.66],["e10c2f52-730c-4a62-8bec-5c4045ddd41a",1.66],["3c017160-9992-43fa-8509-20647861df7b",1.66],["fd046e72-01c6-4669-aa89-b01bc3a02f95",1.66],["7f4ec18e-b817-4bef-a5ba-24956d108931",1.66],["00e8288a-9f04-454c-a34f-1fa8c7afc4e4",1.66],["992073ac-fd42-4679-8d8a-ebad885526f5",1.66],["9253b3aa-492f-44f4-95ed-0ed789c21543",1.66],["4be81f9d-d9bb-4646-ba0e-e3fdf558af3c",1.76]];
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("word-efficiency-hindi-test1-model.json"), initial = await read("word-efficiency-hindi-test1-initial.json");
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
insert into public.word_efficiency_versions values('${version}','${testId}','EFFICIENCY TEST 1','Hindi',25,10,'{}'::jsonb,null);
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

const full = { 1: 1.66, 2: 1.66, 3: 1.66, 4: 1.66, 5: 1.66, 6: 1.66, 7: 1.66, 8: 1.66, 9: 1.66, 10: 1.66, 11: 1.66, 12: 1.66, 13: 1.66, 14: 1.66, 15: 1.76 };
const lost = (result, question) => Math.round((full[question] - result[question]) * 100) / 100;

test("my attempt done the Word 2013 way earns 25/25", async () => {
  const result = await marks(model);
  assert.deepEqual(result, full);
  assert.equal(Math.round(total(result) * 100) / 100, 25);
});

test("the untouched paper earns nothing", async () => {
  assert.equal(total(await marks(initial)), 0);
});

test("Q1-Q4: each half of a two-part question is marked on its own", async () => {
  const red = clone(model);
  for (const run of body(red, 0).runs) if (run.color === "FF00FF") run.color = "FF0000";
  assert.equal(lost(await marks(red), 1), 0.83, "red is not pink");
  const black = clone(model);
  for (const run of body(black, 1).runs) { run.outline = false; run.color = "020618"; }
  assert.equal(lost(await marks(black), 2), 1.66);
  const firstLine = clone(model);
  body(firstLine, 0).attrs.specialIndentMode = "firstLine";
  assert.equal(lost(await marks(firstLine), 3), 0.83, "first line is not hanging");
  const short = clone(model);
  body(short, 1).attrs.specialIndentAmount = "0.5in";
  assert.equal(lost(await marks(short), 4), 1.66);
});

test("Q5-Q6: a missed नालंदा, a yellow underline, or a yellow highlight lose the question or its half", async () => {
  const yellow = clone(model);
  for (const block of yellow.blocks) for (const run of block.runs ?? []) if (run.text === "ukyank") run.underlineColor = "FFFF00";
  assert.equal(lost(await marks(yellow), 5), 1.66);
  const highlight = clone(model);
  for (const block of highlight.blocks) for (const run of block.runs ?? []) if (run.text === "lkseokj") run.highlight = "FFFF00";
  assert.equal(lost(await marks(highlight), 6), 0.83);
});

test("Q7-Q9: header and footer text in Kruti Dev needs a Kruti Dev font; positions and sizes are marked on their own; Unicode Hindi is accepted", async () => {
  const latin = clone(model);
  block(latin, "header").runs[0].fontFamily = "Calibri";
  assert.equal(lost(await marks(latin), 7), 1.66, "Kruti Dev keys in Calibri do not show राजस्थान");
  const unicode = clone(model);
  Object.assign(block(unicode, "header").runs[0], { text: "राजस्थान एल.डी.सी.", fontFamily: "Mangal" });
  assert.equal(lost(await marks(unicode), 7), 0);
  const small = clone(model);
  block(small, "footer").runs[2].fontSize = 12;
  assert.equal(lost(await marks(small), 8), 0.83);
  const centre = clone(model);
  block(centre, "footer").runs[1].text = "";
  assert.equal(lost(await marks(centre), 8), 0.83, "one tab is the centre position");
  const one = clone(model);
  block(one, "footer").runs[0].text = "1";
  assert.equal(lost(await marks(one), 9), 0.83, "the page number must start at 4");
  const right = clone(model);
  block(right, "footer").runs[0].field = "page-number|current|right";
  assert.equal(lost(await marks(right), 9), 0.83);
});

test("Q10-Q15: A3 portrait, a faded watermark, a flat list, no new row, an unsorted column, or the wrong cell lose their marks", async () => {
  const portrait = clone(model);
  portrait.pageLayout.aspectRatio = "29.7 / 42";
  assert.equal(lost(await marks(portrait), 10), 0.83);
  const a4 = clone(model);
  a4.pageLayout.aspectRatio = "29.7 / 21";
  assert.equal(lost(await marks(a4), 10), 1.66);
  const faded = clone(model);
  faded.pageLayout.watermarkSemitransparent = "true";
  assert.equal(lost(await marks(faded), 11), 0.83);
  const flat = clone(model);
  for (const item of flat.blocks) if (item.type === "list-item") item.attrs.listLevel = "1";
  assert.equal(lost(await marks(flat), 12), 1.66);
  const noRow = clone(model);
  rows(noRow).rows.splice(1, 1); rows(noRow).cellFormats.splice(1, 1);
  assert.equal(lost(await marks(noRow), 13), 1.66);
  const unsorted = clone(model);
  const r = rows(unsorted).rows; [r[2], r[10]] = [r[10], r[2]];
  assert.equal(lost(await marks(unsorted), 14), 1.66);
  const wrongCell = clone(model);
  delete rows(wrongCell).cellFormats[2][2].shading; rows(wrongCell).cellFormats[3][2].shading = "FFC000";
  assert.equal(lost(await marks(wrongCell), 15), 1.76);
});

test("Q15 also accepts the cell shaded before the sort (the row that was third ends last), but only when that row exists", async () => {
  const before = clone(model);
  delete rows(before).cellFormats[2][2].shading; rows(before).cellFormats[10][2].shading = "FFC000";
  assert.equal(lost(await marks(before), 15), 0);
  assert.equal((await marks(initial))[15], 0, "an untouched 10-row table has no row 11 to pass");
});
