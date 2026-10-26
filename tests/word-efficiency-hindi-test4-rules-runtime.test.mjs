import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi EFFICIENCY TEST 4 (15 questions in Hindi, working document = 6 English paragraphs and two series lines) is
// marked by rule criteria. This runs my attempt, saved from the real editor after doing every question the
// Word 2013 way, and changed copies of it through the real SQL marking.

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
  "202610251000_word_efficiency_case_sensitive_text_rule.sql",
  "202610261600_word_efficiency_whole_word_text_rule.sql",
  "202610261700_word_efficiency_hindi_test4_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "990b4098-5cd2-4f9b-9e58-904a3e532417", testId = "d22b43e0-e756-4877-8786-7703eb0d541b";
const QUESTIONS = [["71d4ee1a-835d-4d30-b56a-9d5fe872ad76",1.66],["57eeb56f-8602-48f5-badc-14548a9af33b",1.66],["cd52b41f-9cb2-46e1-8a75-5dce2078fa06",1.66],["ad9b81d7-0016-442e-b821-ae7341bed671",1.66],["fc6ad12d-5260-4d89-bf11-de4ca8ddd5d8",1.66],["052d9b96-7971-404c-a1d9-83e24387777d",1.66],["671e82ce-678b-4daf-9945-5c7d374e589b",1.66],["30c573ca-48f3-45bc-9e25-abadd6896095",1.66],["671eb64d-5867-40bf-9dd7-f818b7127d3b",1.66],["63de9e4e-6bf8-4f45-aa25-4bcc0d1b2d63",1.66],["7e5abbee-31c8-4a50-85c7-0f3abeffbd0d",1.66],["b8204b45-d107-47b9-9443-eb1dfacfcc98",1.66],["f56d3ce9-b8b5-4860-b50e-0b6bb6470e0a",1.66],["c649fdf6-ce09-4033-bca5-f415ee4a83bb",1.66],["a3413688-5be2-4530-945c-4394b3ce64d0",1.76]];
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("word-efficiency-hindi-test4-model.json"), initial = await read("word-efficiency-hindi-test4-initial.json");
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
create table public.word_efficiency_versions(id uuid primary key, test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb, working_matter_snapshot jsonb);
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

const full = { 1: 1.66, 2: 1.66, 3: 1.66, 4: 1.66, 5: 1.66, 6: 1.66, 7: 1.66, 8: 1.66, 9: 1.66, 10: 1.66, 11: 1.66, 12: 1.66, 13: 1.66, 14: 1.66, 15: 1.76 };
const lost = (result, question) => Math.round((full[question] - result[question]) * 100) / 100;
const footer = (doc) => block(doc, "footer");

test("my attempt done the Word 2013 way earns 25/25", async () => {
  const result = await marks(model);
  assert.deepEqual(result, full);
  assert.equal(Math.round(total(result) * 100) / 100, 25);
});

test("the untouched paper earns nothing", async () => {
  assert.equal(total(await marks(initial)), 0);
});

test("Q10 asks for the word 'you': the 'you' inside 'your' needs no highlight, a missed 'you' loses the part", async () => {
  const missed = clone(model);
  const you = body(missed, 3).runs.find((run) => /^you$/i.test(run.text.trim()));
  you.highlight = null;
  assert.equal(lost(await marks(missed), 10), 0.83);
  assert.ok(body(model, 3).runs.some((run) => /your/i.test(run.text) && !run.highlight), "'your' stays unhighlighted in the model");
});

test("parts are marked separately: one paragraph without border, single spacing, portrait, wrong start number", async () => {
  const border = clone(model); delete body(border, 2).attrs.border;
  assert.equal(lost(await marks(border), 1), 0.55);
  const spacing = clone(model); body(spacing, 0).attrs.lineHeight = "1.15";
  assert.equal(lost(await marks(spacing), 5), 0.55);
  const portrait = clone(model); portrait.pageLayout.aspectRatio = "18.41 / 26.67";
  assert.equal(lost(await marks(portrait), 13), 0.41, "Executive kept, Landscape lost");
  const one = clone(model); for (const run of footer(one).runs) if (run.field?.startsWith("page-number")) run.text = "\t\t1";
  assert.equal(lost(await marks(one), 14), 0.83);
});

test("numbering, drop cap and the footer text are each checked", async () => {
  const unnumbered = clone(model); body(unnumbered, 5).type = "paragraph"; delete body(unnumbered, 5).attrs.listStyle;
  assert.equal(lost(await marks(unnumbered), 2), 1.66);
  const threeLines = clone(model); body(threeLines, 3).attrs.dropCapLines = 3;
  assert.equal(lost(await marks(threeLines), 15), 1.76);
  const unicode = clone(model); footer(unicode).runs[0].text = "समृद्धि क्लासेस "; footer(unicode).runs[0].fontFamily = "Mangal";
  assert.equal(lost(await marks(unicode), 3), 0, "Unicode Hindi is accepted too");
  const noText = clone(model); footer(noText).runs[0].text = " ";
  assert.equal(lost(await marks(noText), 3), 1.66);
});
