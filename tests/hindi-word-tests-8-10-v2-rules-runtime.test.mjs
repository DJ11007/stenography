import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi Word EFFICIENCY TEST 8, 9 and 10, new papers (25 Nov 2026): every question asks for a Word 2013 tool or option
// that no other Word Efficiency paper uses, over HOME, INSERT, DESIGN, PAGE LAYOUT and TABLE TOOLS. Each paper was solved
// in the real editor (dev harness, ?test=8v2 / 9v2 / 10v2) and saved as tests/fixtures/hindi-word-test{8,9,10}-v2-model.json.
// This runs the solved and the untouched papers through the real SQL marking with the checks from
// scripts/build-hindi-word-tests-8-10-v2.mts, runs the server's capability check (a switched-off tool made Test 7's
// submit fail on 25 Nov) with ONLY the tools the migration switches on, and applies the migration itself.

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const json = async (path) => JSON.parse(await read(path));
const MARKING = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql", "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql", "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql", "202610151200_word_efficiency_rules_block_kind.sql",
  "202610181500_word_efficiency_part_marks.sql", "202610191200_word_efficiency_words_only_runs.sql",
  "202610191300_word_efficiency_page_border_sides.sql", "202610191900_word_efficiency_nbsp_equals_space.sql",
  "202610201200_word_efficiency_rule_criteria.sql", "202610241000_word_efficiency_list_and_table_rules.sql",
  "202610251000_word_efficiency_case_sensitive_text_rule.sql", "202610261600_word_efficiency_whole_word_text_rule.sql",
  "202610291100_word_efficiency_model_answer_rule_criteria.sql", "202610291200_word_efficiency_page_border_options.sql",
  "202611221000_word_words_rule_skip_drop_cap_letter.sql", "202611221100_word_rule_allof_and_test4_rules.sql",
  "202611221300_word_words_rule_skip_drop_cap_word.sql", "202611221500_word_table_header_spaces_and_test5_q1_q7.sql",
];
const MIGRATION = "supabase/migrations/202611251200_hindi_word_tests_8_10_new_papers.sql";
const spec = await json("tests/fixtures/hindi-word-tests-8-10-v2.json");
const NUMBERS = [8, 9, 10];
const fixtures = Object.fromEntries(await Promise.all(NUMBERS.map(async (n) => [n, { model: await json(`tests/fixtures/hindi-word-test${n}-v2-model.json`), initial: await json(`tests/fixtures/hindi-word-test${n}-v2-initial.json`) }])));
const MARKS = Array.from({ length: 15 }, (_, i) => (i === 14 ? 1.76 : 1.66));

async function emptyDatabase() {
  const db = new PGlite();
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
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid, title text, language text, current_version_number int, auto_publish_results boolean, updated_at timestamptz);
create table public.word_efficiency_versions(id uuid primary key default gen_random_uuid(), test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb, working_matter_snapshot jsonb,
  version_number int, description text, instructions_markdown text, delivery_onscreen boolean, delivery_pdf boolean, delivery_realfile boolean, student_question_toggle boolean, question_count int, duration_options jsonb, created_by uuid);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, instruction text, display_order int, marks numeric, section text, is_visible boolean, solution text);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, selected_duration_seconds int, started_at timestamptz, snapshot jsonb, result jsonb, submitted_at timestamptz, updated_at timestamptz, original_document_snapshot jsonb, final_document_snapshot jsonb, document_autosave jsonb, evaluation_status text, evaluated_at timestamptz, evaluated_by uuid, result_published_at timestamptz);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, graded_at timestamptz, updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb, created_at timestamptz default now(), part_label text);
`);
  // The capability check the server runs on every autosave and submit, with the pieces it uses.
  const fn = async (file, name) => { const s = await read(`supabase/migrations/${file}`); const i = s.lastIndexOf(`create or replace function public.${name}(`); const start = s.indexOf("$$", i); return s.slice(i, s.indexOf("$$;", s.indexOf("$$", start + 2)) + 3); };
  for (const [file, name] of [
    ["202608250013_repair_word_efficiency_margin_serialization.sql", "word_efficiency_canonical_measurement"],
    ["202608310049_word_efficiency_outline_and_emboss.sql", "word_efficiency_document_feature"],
    ["202611251000_word_hyphenation_command_and_test7_8_tools.sql", "word_efficiency_command_enabled"],
    ["202608310049_word_efficiency_outline_and_emboss.sql", "assert_word_efficiency_capability_changes"],
  ]) await db.exec(await fn(file, name));
  for (const name of MARKING) await db.exec(await read(`supabase/migrations/${name}`));
  await db.exec(`
create function public.valid_additional_criteria_shape(criteria jsonb) returns boolean language plpgsql immutable as $$
begin perform public.assert_word_efficiency_additional_criteria(criteria); return true; exception when others then return false; end $$;
alter table public.word_efficiency_grading_rules add constraint shape check (public.valid_additional_criteria_shape(additional_criteria));`);
  return db;
}

// The three tests as they are before the migration: an old version with an old question 1 and settings with nothing on.
let migrated;
async function migratedDatabase() {
  if (migrated) return migrated;
  const db = await emptyDatabase();
  for (const n of NUMBERS) {
    const tag = String(n).padStart(2, "0");
    const version = `8${tag}00000-0000-0000-0000-000000000002`, testId = `8${tag}00000-0000-0000-0000-000000000001`;
    await db.query("insert into public.word_efficiency_tests(id,current_version_id,title,language,current_version_number,auto_publish_results) values($1,$2,$3,'Hindi',2,false)", [testId, version, `EFFICIENCY TEST ${n}`]);
    await db.query("insert into public.word_efficiency_versions(id,test_id,title,language,maximum_marks,passing_marks,editor_capabilities,working_matter_snapshot,version_number,question_count,duration_options) values($1,$2,$3,'Hindi',25,10,$4::jsonb,'{}'::jsonb,2,15,'[600]'::jsonb)",
      [version, testId, `EFFICIENCY TEST ${n}`, JSON.stringify({ schemaVersion: "2", tabs: {} })]);
    await db.query("insert into public.word_efficiency_questions(version_id,question_number,instruction,display_order,marks) values($1,1,'old question',1,1.66)", [version]);
  }
  migrated = { db, results: await db.exec(await read(MIGRATION)) };
  return migrated;
}

async function marks(db, title, document) {
  const { rows } = await db.query(
    `select q.question_number as n, (public.word_efficiency_score_question($1::jsonb, q.version_id, q.id, q.marks, null)).awarded::float as awarded
     from public.word_efficiency_tests t join public.word_efficiency_questions q on q.version_id = t.current_version_id where t.title = $2 order by q.question_number`,
    [JSON.stringify(document), title],
  );
  return rows.map((row) => row.awarded);
}
const total = (list) => Math.round(list.reduce((sum, value) => sum + value, 0) * 100) / 100;

test("three papers of 15 questions; no instruction repeats across the new Tests 7-10", async () => {
  const test7 = (await json("tests/fixtures/hindi-word-tests-7-8.json")).tests[0];
  const all = [...test7.questions, ...spec.tests.flatMap((paper) => paper.questions)].map((q) => q.instruction);
  assert.deepEqual(spec.tests.map((paper) => paper.questions.length), [15, 15, 15]);
  assert.equal(new Set(all).size, all.length);
  // Questions the older papers ask are not asked again.
  for (const old of ["Replace All", "Page Break", "UPPERCASE", "Superscript", "Subscript", "Orientation", "Insert Table", "©", "®", "™", "Legal", "Executive", "Moderate", "Narrow", "Wide"]) {
    for (const paper of spec.tests) assert.ok(!paper.questions.some((q) => q.instruction.includes(old)), `${paper.title}: ${old}`);
  }
});

for (const [index, n] of NUMBERS.entries()) {
  const title = `EFFICIENCY TEST ${n}`;
  test(`${title}: the paper solved in the real editor earns 25/25 and the untouched paper 0`, async () => {
    const { db } = await migratedDatabase();
    assert.deepEqual(await marks(db, title, fixtures[n].model), MARKS);
    assert.equal(total(await marks(db, title, fixtures[n].initial)), 0);
    assert.equal(spec.tests[index].title, title);
  });

  test(`${title}: the server's capability check accepts the solved paper with only the tools the migration switches on`, async () => {
    const { db } = await migratedDatabase();
    const { rows: [{ caps }] } = await db.query("select v.editor_capabilities caps from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id where t.title = $1", [title]);
    await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [JSON.stringify(fixtures[n].model), JSON.stringify(fixtures[n].initial), JSON.stringify(caps)]);
    // ...and the check is real: with nothing switched on the same paper is refused.
    await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [JSON.stringify(fixtures[n].model), JSON.stringify(fixtures[n].initial), JSON.stringify({ schemaVersion: "2", tabs: {} })]), /Disabled/);
  });
}

test("the migration makes a new version per test, publishes automatically, reports 25 / 0 / nothing off, and runs only once", async () => {
  const { db, results } = await migratedDatabase();
  const check = results.findLast((result) => result.rows.length).rows;
  assert.deepEqual(check.map((row) => [row.title, row.current_version_number, Number(row.total), Number(row.model_answer_gets), Number(row.untouched_paper_gets), row.tools_off]), [
    ["EFFICIENCY TEST 10", 3, 25, 25, 0, ""], ["EFFICIENCY TEST 8", 3, 25, 25, 0, ""], ["EFFICIENCY TEST 9", 3, 25, 25, 0, ""],
  ]);
  const { rows } = await db.query("select t.title, t.auto_publish_results, (select count(*)::int from public.word_efficiency_grading_rules r where r.version_id = t.current_version_id) rules from public.word_efficiency_tests t order by t.title");
  assert.deepEqual(rows.map((row) => [row.auto_publish_results, row.rules]), [[true, 15], [true, 15], [true, 15]]);
  await db.exec(await read(MIGRATION));
  const { rows: [{ versions }] } = await db.query("select count(*)::int versions from public.word_efficiency_versions");
  assert.equal(versions, 6);
});
