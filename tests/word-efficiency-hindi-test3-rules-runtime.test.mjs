import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi EFFICIENCY TEST 3 (15 questions in Hindi, working document = a Kruti Dev paragraph and 4 English
// paragraphs) is marked by rule criteria. This runs my attempt, saved from the real editor after doing every
// question the Word 2013 way, and changed copies of it through the real SQL marking.

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
  "202610261400_word_efficiency_hindi_test3_rules.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "766b80e8-41d9-4a21-be3a-f675cd128b0d", testId = "7d385bad-9252-4327-8271-4a7b903becbd";
const QUESTIONS = [["ed28067f-3972-4cd0-a60e-f8ec250ad8ae",1.66],["4742bbea-1796-4938-93a3-b2e00049eaab",1.66],["397687ba-4dae-451b-aab8-86751de7c3f4",1.66],["901667ec-4045-4110-b25c-36a4f2e96740",1.66],["412e2979-25f1-42e3-8858-055788bce7ad",1.66],["0f682329-e260-46ae-aa55-132afc9177e4",1.66],["f11629ee-9aeb-4ec2-8d3d-287b359e5099",1.66],["9699ce35-b121-4656-9156-a6b7a5d9ed5c",1.66],["7f4c12f6-8f72-4ae1-add5-9923c2c7d88a",1.66],["eb6daca8-0ba4-4d82-bc9a-d41227061951",1.66],["c4b12ac0-d5fd-4ab8-9bd5-979be5224f7b",1.66],["e034e4da-955f-418c-8063-5d7e2f585b41",1.66],["0629c3cc-a63e-42c3-9a22-11f0f0d5c5db",1.66],["4da228d7-da36-4ea2-83cd-576f7b59840d",1.66],["b7e6613a-146e-4da8-a515-8b42976e6262",1.76]];
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("word-efficiency-hindi-test3-model.json"), initial = await read("word-efficiency-hindi-test3-initial.json");
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
insert into public.word_efficiency_versions values('${version}','${testId}','EFFICIENCY TEST 3','Hindi',25,10,'{}'::jsonb,null);
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

test("paragraphs 4 and 5 are marked by their text, with or without the table", async () => {
  const noTable = clone(model);
  noTable.blocks.splice(noTable.blocks.indexOf(block(noTable, "table")), 1);
  const result = await marks(noTable);
  for (const question of [9, 11]) assert.equal(lost(result, question), 0, `Q${question} still found`);
  for (const question of [8, 13, 14]) assert.ok(lost(result, question) > 0, `Q${question} needs the table`);
});

test("a half done or wrongly done question loses its marks", async () => {
  const spacing = clone(model); body(spacing, 1).attrs.marginBottom = "8pt";
  assert.equal(lost(await marks(spacing), 5), 0.83, "spacing after left at 8 pt");
  const empty = clone(model); rows(empty).rows = rows(empty).rows.map((row) => row.map(() => "")); for (const item of block(empty, "table").runs) item.text = "";
  assert.equal(lost(await marks(empty), 13), 0.83, "a table with no data");
  const black = clone(model); for (const format of rows(black).cellFormats[0]) format.color = "000000";
  assert.equal(lost(await marks(black), 14), 1.66, "the first row left black");
  const yellow = clone(model); for (const item of body(yellow, 2).runs) if (item.highlight) item.highlight = "FFFF00";
  assert.equal(lost(await marks(yellow), 7), 1.66);
  const expanded = clone(model); for (const item of body(expanded, 1).runs) item.charSpacing = 0.3;
  assert.equal(lost(await marks(expanded), 15), 1.76, "expanded is not condensed");
  const single = clone(model); for (const item of body(single, 4).runs) item.underlineStyle = "single";
  assert.equal(lost(await marks(single), 9), 0.83);
});
