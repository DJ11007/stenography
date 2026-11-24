import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Hindi Word EFFICIENCY TEST 7, new paper (24 Nov 2026): every question asks for a Word 2013 tool that no other
// Word Efficiency paper uses (Grow Font, Small caps, Hidden, Spacing Before, Checkmark bullets, Table Style, table
// alignment, Delete Columns, Repeat Header Rows, Page Border > Measure from Text, Columns, Line Numbers, Hyphenation,
// Gutter, Section Break). The paper was solved in the real editor (dev harness, ?test=7n) and saved as
// tests/fixtures/hindi-word-test7-v2-model.json; this runs it, the untouched paper and changed copies of it through
// the real SQL marking with the checks from scripts/build-hindi-word-tests-7-8.mts.

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
  "202610291100_word_efficiency_model_answer_rule_criteria.sql",
  "202610291200_word_efficiency_page_border_options.sql",
  "202611221000_word_words_rule_skip_drop_cap_letter.sql",
  "202611221100_word_rule_allof_and_test4_rules.sql",
  "202611221300_word_words_rule_skip_drop_cap_word.sql",
  "202611221500_word_table_header_spaces_and_test5_q1_q7.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const paper = (await read("hindi-word-tests-7-8.json")).tests[0];
const model = await read("hindi-word-test7-v2-model.json"), initial = await read("hindi-word-test7-v2-initial.json");
const version = "70000000-0000-0000-0000-000000000002", testId = "70000000-0000-0000-0000-000000000001";
const questionId = (n) => `70000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`;
// The migration's marks: 1.66 each, the last question the rest of 25.
const MARKS = paper.questions.map((_, index, all) => index === all.length - 1 ? Math.round((25 - 1.66 * (all.length - 1)) * 100) / 100 : 1.66);
const clone = (value) => JSON.parse(JSON.stringify(value));
const body = (doc) => doc.blocks.filter((b) => !["header", "footer"].includes(b.type));
const table = (doc) => doc.blocks.find((b) => b.type === "table");

let db;
// The marking functions on stand-in tables (the columns the migration and the marking use).
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
create function public.assert_word_efficiency_capability_changes(d jsonb, baseline jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid, title text, language text, current_version_number int, auto_publish_results boolean, updated_at timestamptz);
create table public.word_efficiency_versions(id uuid primary key default gen_random_uuid(), test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb, working_matter_snapshot jsonb,
  version_number int, description text, instructions_markdown text, delivery_onscreen boolean, delivery_pdf boolean, delivery_realfile boolean, student_question_toggle boolean, question_count int, duration_options jsonb, created_by uuid);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, instruction text, display_order int, marks numeric, section text, is_visible boolean, solution text);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, selected_duration_seconds int, started_at timestamptz, snapshot jsonb, result jsonb, submitted_at timestamptz, updated_at timestamptz, original_document_snapshot jsonb, final_document_snapshot jsonb, document_autosave jsonb, evaluation_status text, evaluated_at timestamptz, evaluated_by uuid, result_published_at timestamptz);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, graded_at timestamptz, updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb, created_at timestamptz default now(), part_label text);
`);
  // The files may have Windows line endings in a checkout; the patch migrations look for exact text with \n.
  for (const migration of migrations) await db.exec((await readFile(migration, "utf8")).replace(/\r\n/g, "\n"));
  // The live table's shape check (migration 202608280039), so the rules must pass it to be saved.
  await db.exec(`
create function public.valid_additional_criteria_shape(criteria jsonb) returns boolean language plpgsql immutable as $$
begin perform public.assert_word_efficiency_additional_criteria(criteria); return true; exception when others then return false; end $$;
alter table public.word_efficiency_grading_rules add constraint shape check (public.valid_additional_criteria_shape(additional_criteria));`);
  return db;
}

async function database() {
  if (db) return db;
  db = await emptyDatabase();
  await db.query("insert into public.word_efficiency_tests(id,current_version_id,title,language) values($1,$2,'EFFICIENCY TEST 7','Hindi')", [testId, version]);
  await db.query("insert into public.word_efficiency_versions(id,test_id,title,language,maximum_marks,passing_marks,editor_capabilities,model_answer_snapshot,working_matter_snapshot) values($1,$2,'EFFICIENCY TEST 7','Hindi',25,10,'{}'::jsonb,$3::jsonb,$4::jsonb)", [version, testId, JSON.stringify(model), JSON.stringify(initial)]);
  for (const [index, question] of paper.questions.entries()) {
    await db.query("insert into public.word_efficiency_questions(id,version_id,question_number,instruction,display_order,marks) values($1,$2,$3,$4,$3,$5)", [questionId(index + 1), version, index + 1, question.instruction, MARKS[index]]);
    await db.query(
      "insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria) values($1,$2,'rule','model-answer-match-v2','null'::jsonb,$3,null,$4::jsonb)",
      [version, questionId(index + 1), MARKS[index], JSON.stringify(question.criteria)],
    );
  }
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
const total = (result) => Math.round(Object.values(result).reduce((sum, value) => sum + value, 0) * 100) / 100;
const full = Object.fromEntries(MARKS.map((value, index) => [index + 1, value]));
const lostOnly = (result) => Object.keys(full).filter((n) => result[n] !== full[n]).map(Number);

test("the paper has 15 questions worth 25 marks, and none of them is a question another Word paper asks", () => {
  assert.equal(paper.questions.length, 15);
  assert.equal(Math.round(MARKS.reduce((a, b) => a + b, 0) * 100) / 100, 25);
  for (const old of ["Page Break", "Replace All", "Watermark", "Orientation", "Superscript", "UPPERCASE", "©", "Sort", "Insert Table"]) {
    assert.ok(!paper.questions.some((q) => q.instruction.includes(old)), `${old} is asked elsewhere`);
  }
});

test("the paper solved in the real editor earns 25/25", async () => {
  const result = await marks(model);
  assert.deepEqual(result, full);
  assert.equal(total(result), 25);
});

test("the untouched paper earns nothing", async () => {
  assert.equal(total(await marks(initial)), 0);
});

test("each question loses its marks, and only its marks, when that one step is missing", async () => {
  const cases = {
    1: (d) => { body(d)[0].runs.forEach((r) => { r.fontSize = 16; }); },
    2: (d) => { body(d)[3].runs.forEach((r) => { r.smallCaps = false; }); },
    3: (d) => { body(d)[8].runs.forEach((r) => { r.hidden = false; }); },
    4: (d) => { body(d)[1].attrs.marginTop = "0pt"; },
    5: (d) => { body(d)[5].attrs.listStyle = "bullet"; },
    6: (d) => { table(d).attrs.tableStyle = "grid-5-dark-accent-1"; },
    7: (d) => { delete table(d).attrs.tableAlign; },
    8: (d) => { table(d).attrs.rows = [["S.No.", "Name", "City", "Marks"], ...table(d).attrs.rows.slice(1).map((row) => [row[0], row[1], "Jaipur", row[2]])]; },
    9: (d) => { table(d).attrs.repeatHeader = false; },
    10: (d) => { d.pageLayout.border = "1px dotted #00B050"; },
    11: (d) => { d.pageLayout.columnCount = "3"; },
    12: (d) => { body(d)[2].attrs.lineNumbers = false; },
    13: (d) => { body(d)[0].attrs.hyphens = null; },
    14: (d) => { d.pageLayout.gutter = "12.7mm"; },
    15: (d) => { d.blocks = d.blocks.filter((b) => b.type !== "section-break"); },
  };
  for (const [question, change] of Object.entries(cases)) {
    const changed = clone(model); change(changed);
    assert.deepEqual(lostOnly(await marks(changed)), [Number(question)], `Q${question}`);
  }
});

test("a Page Break (not a Section Break) before the table does not answer Q15", async () => {
  const pageBreak = clone(model);
  pageBreak.blocks.find((b) => b.type === "section-break").type = "page-break";
  assert.deepEqual(lostOnly(await marks(pageBreak)), [15]);
});

test("the migration adds the paper as a new version, switches on the tools it needs, and runs only once", async () => {
  const live = await emptyDatabase();
  const oldVersion = "71000000-0000-0000-0000-000000000002", oldTest = "71000000-0000-0000-0000-000000000001";
  // The old paper's settings: no Grow Font, no Page Layout tab at all.
  const oldCaps = { schemaVersion: 1, tabs: { Home: { enabled: true, groups: { font: { enabled: true, options: { bold: true, increaseFontSize: false } } } } } };
  await live.query("insert into public.word_efficiency_tests(id,current_version_id,title,language,current_version_number,auto_publish_results) values($1,$2,'EFFICIENCY TEST 7','Hindi',3,true)", [oldTest, oldVersion]);
  await live.query("insert into public.word_efficiency_versions(id,test_id,title,language,maximum_marks,passing_marks,editor_capabilities,working_matter_snapshot,version_number,question_count,duration_options) values($1,$2,'EFFICIENCY TEST 7','Hindi',25,10,$3::jsonb,$4::jsonb,3,15,'[600]'::jsonb)", [oldVersion, oldTest, JSON.stringify(oldCaps), JSON.stringify(initial)]);
  await live.query("insert into public.word_efficiency_questions(version_id,question_number,instruction,display_order,marks) values($1,1,'old question',1,1.66)", [oldVersion]);
  const migration = (await readFile(new URL("../supabase/migrations/202611241200_hindi_word_test7_new_questions.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const results = await live.exec(migration);
  const check = results.findLast((result) => result.rows.length).rows[0];
  assert.equal(Number(check.total), 25);
  assert.equal(Number(check.model_answer_gets), 25);
  assert.equal(Number(check.untouched_paper_gets), 0);
  assert.equal(check.tools_off, "");
  assert.equal(check.current_version_number, 4);
  const { rows: [current] } = await live.query("select t.current_version_id, t.auto_publish_results, v.editor_capabilities caps, (select count(*)::int from public.word_efficiency_grading_rules r where r.version_id = v.id) rules from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id");
  assert.notEqual(current.current_version_id, oldVersion);
  assert.equal(current.rules, 15);
  assert.equal(current.auto_publish_results, true);
  assert.equal(current.caps.tabs.Home.groups.font.options.bold, true, "the old settings are kept");
  assert.equal(current.caps.tabs["Page Layout"].groups.pageSetup.options.lineNumbers, true);
  // A second run changes nothing.
  await live.exec(migration);
  const { rows: [{ versions }] } = await live.query("select count(*)::int versions from public.word_efficiency_versions");
  assert.equal(versions, 2);
});
