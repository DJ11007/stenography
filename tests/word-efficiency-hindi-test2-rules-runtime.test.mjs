import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi EFFICIENCY TEST 2 (15 questions in Hindi, working document = 6 English paragraphs) is marked by rule
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
  "202610251000_word_efficiency_case_sensitive_text_rule.sql",
  "202610251010_word_efficiency_hindi_test2_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "33a36886-41a9-4993-b167-dc10f2735630", testId = "176ed4b0-c1bf-492b-8eac-f22751546b9c";
const QUESTIONS = [["d768ad75-585e-428a-a556-b2f3ac95d4ed",1.66],["a62d8323-15cf-4f65-8fc8-d59f4e350566",1.66],["b42c62bb-8e4e-4423-a19d-e54f42dabe47",1.66],["f12c5688-27f0-47da-bc6c-9f2a01db563a",1.66],["595b2e0d-47b8-45db-bc29-d74768ff70fe",1.66],["caca2272-2706-4c87-9452-6a3837cf822c",1.66],["28d7ab67-2d1e-4b1c-8f28-d9499d9cd41f",1.66],["5aae3821-ea4c-42ee-bd7d-2177a847ac14",1.66],["4409a5a0-2bf9-478d-963b-e82d2f046561",1.66],["024a6233-fd07-476b-9aa1-55e794d7300c",1.66],["c10c0a8a-9f35-467e-8668-c625634ab184",1.66],["7d54e215-2466-4038-b096-634cfdc59583",1.66],["4786dc66-0d1d-4d11-9cfd-85c4bc7f8537",1.66],["57957523-8cd9-4807-a896-b29c6c20593a",1.66],["fb9ab680-dcb3-403a-b369-589147625f34",1.76]];
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("word-efficiency-hindi-test2-model.json"), initial = await read("word-efficiency-hindi-test2-initial.json");
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

test("Q1-Q5: a missed 'document', the wrong font, lower case or left alignment lose the question or its half", async () => {
  const one = clone(model);
  const run = body(one, 0).runs.find((item) => /^document$/i.test(item.text)); run.strike = false;
  assert.equal(lost(await marks(one), 1), 1.66);
  const arial = clone(model);
  for (const item of body(arial, 0).runs) item.fontFamily = "Arial";
  assert.equal(lost(await marks(arial), 3), 0.83);
  const upper = clone(model);
  for (const item of body(upper, 1).runs) item.text = item.text.toUpperCase();
  assert.equal(lost(await marks(upper), 4), 1.66, "UPPERCASE is not tOGGLE cASE");
  const left = clone(model);
  body(left, 1).alignment = "left";
  assert.equal(lost(await marks(left), 5), 1.66);
});

test("Q6-Q10: yellow highlight, no subscript, no copy, a bullet-free underline on spaces, or another font lose their marks", async () => {
  const yellow = clone(model);
  for (const item of body(yellow, 2).runs) item.highlight = "FFFF00";
  assert.equal(lost(await marks(yellow), 6), 1.66);
  const noSub = clone(model);
  for (const item of body(noSub, 3).runs) item.subscript = false;
  assert.equal(lost(await marks(noSub), 7), 1.66);
  const noCopy = clone(model);
  noCopy.blocks.splice(noCopy.blocks.indexOf(body(noCopy, 5)), 1);
  const result = await marks(noCopy);
  assert.equal(lost(result, 8), 1.66);
  assert.equal(lost(result, 10), 1.66);
  const single = clone(model);
  for (const item of body(single, 3).runs) { item.underlineStyle = "single"; item.underlineWordsOnly = false; }
  assert.equal(lost(await marks(single), 9), 0.83, "a single underline also underlines the spaces");
  const calibri = clone(model);
  for (const item of body(calibri, 5).runs) item.fontFamily = "Calibri";
  assert.equal(lost(await marks(calibri), 10), 1.66);
});

test("Q11-Q15: lower case, left alignment, no shading, single spacing or bullets lose their marks; word shading is accepted", async () => {
  const lower = clone(model);
  for (const item of body(lower, 2).runs) item.text = item.text.toLowerCase();
  assert.equal(lost(await marks(lower), 11), 1.66);
  const left = clone(model);
  body(left, 0).alignment = "left";
  assert.equal(lost(await marks(left), 12), 1.66);
  const words = clone(model);
  delete body(words, 3).attrs.backgroundColor;
  assert.equal(lost(await marks(words), 13), 1.66);
  for (const item of body(words, 3).runs) item.highlight = "FF0000";
  assert.equal(lost(await marks(words), 13), 0, "red behind every word counts too");
  const single = clone(model);
  body(single, 2).attrs.lineHeight = "1.15";
  assert.equal(lost(await marks(single), 14), 1.66);
  const bullets = clone(model);
  body(bullets, 4).attrs.listStyle = "bullet-disc";
  assert.equal(lost(await marks(bullets), 15), 1.76, "bullets are not a numbered list");
});
