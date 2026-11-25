import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validateExcelDocument } from "../lib/excel-document.ts";

// EXCEL EFFICIENCY TEST 9, version 2 (26 Nov 2026): 3 formulas with functions no other Excel paper uses (MONTH,
// ROUNDUP, LOWER) and 12 tools no other paper asks for. Built by scripts/build-excel-test9-v2.mjs. This runs every
// question's checks through the real SQL marking functions: the solved sheet passes each one, the untouched sheet none.

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const json = async (path) => JSON.parse(await read(path));
const rules = await json("tests/fixtures/excel-test9-v2-rules.json");
const model = await json("tests/fixtures/excel-test9-v2-model.json");
const initial = await json("tests/fixtures/excel-test9-v2-initial.json");
const untouched = { schemaVersion: "3", rows: initial.rows, cols: initial.cols, cells: initial.cells, merges: [], sheet: {}, operations: [], savedAt: "2026-11-26T00:00:00.000Z" };

// A function's latest text in a migration (CREATE OR REPLACE ... AS $function$ ... $function$;).
async function fn(file, name) {
  const s = await read(`supabase/migrations/${file}`), lower = s.toLowerCase();
  const i = lower.lastIndexOf(`create or replace function public.${name}(`);
  const tag = s.slice(i).match(/\sas\s+(\$[a-z]*\$)/i)[1];
  const start = s.indexOf(tag, i);
  return s.slice(i, s.indexOf(`${tag};`, start + tag.length) + tag.length + 1);
}

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  for (const [file, name] of [
    ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "excel_efficiency_prop_matches"],
    ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "excel_efficiency_column_index"],
    ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "excel_efficiency_column_letters"],
    ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "excel_efficiency_range_cells"],
    ["202611171000_excel_cell_prop_default_decimals.sql", "excel_efficiency_cell_prop"],
    ["202611220900_excel_grading_cell_lookup_speed.sql", "excel_efficiency_criterion_matches"],
  ]) await db.exec(await fn(file, name));
  return db;
}
const passes = async (doc, criterion) => (await (await database()).query("select public.excel_efficiency_criterion_matches($1::jsonb, $2::jsonb) ok", [JSON.stringify(doc), JSON.stringify(criterion)])).rows[0].ok;

test("15 questions, 25 marks, exactly 3 of them formulas, none asked by another Excel paper", async () => {
  assert.equal(rules.length, 15);
  assert.equal(rules.reduce((sum, q) => sum + q.marks, 0), 25);
  assert.equal(rules.filter((q) => q.criteria.some((c) => c.rule === "value" && c.formula)).length, 3);
  const others = (await Promise.all(["4", "4-v2", "4-v3", "5", "5-v2", "6", "7", "8", "9"].map((n) => read(`scripts/build-excel-test${n}.mjs`)))).join("\n");
  for (const fnName of ["MONTH(", "ROUNDUP(", "LOWER("]) assert.ok(!others.includes(`=${fnName}`), `${fnName} is used by another paper`);
  // ("Column Width" alone would also match the other papers' "AutoFit Column Width", a different command.)
  for (const tool of ["Duplicate Values", "Data Bars", "Comment", "Hide", "Row Height", "Set the Column Width", "Angle Counterclockwise", "Center on page", "Scale to Fit", "Double Underline", "Data Validation", "Freeze the First Column"]) {
    assert.ok(rules.some((q) => q.text.includes(tool)), tool);
    assert.ok(!others.includes(tool), `${tool} is asked by another paper`);
  }
});

test("the solved sheet is a valid editor document", () => {
  validateExcelDocument(model);
});

for (const question of await json("tests/fixtures/excel-test9-v2-rules.json")) {
  test(`Q${question.n}: every check passes on the solved sheet, and the untouched sheet fails it`, async () => {
    for (const criterion of question.criteria) assert.equal(await passes(model, criterion), true, JSON.stringify(criterion).slice(0, 160));
    const failed = await Promise.all(question.criteria.map((criterion) => passes(untouched, criterion)));
    assert.ok(failed.includes(false), `Q${question.n} is already met by the untouched sheet`);
  });
}

// The migration on a copy of TEST 9's live version 1, with the database's own sheet checks (the Excel migrations up
// to 202610311000, as tests/excel-autofit-marking.test.mjs loads them).
test("the migration builds version 2 from the live sheet: the tested questions and checks, a valid solved sheet, once", async () => {
  const live = new PGlite();
  await live.exec(`
create schema auth; create table auth.state(uid uuid);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated; create role service_role;
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.evaluate_excel_grading_rule(d jsonb, t text, o text, v jsonb, a numeric, p numeric) returns numeric language sql immutable as $$select 0::numeric$$;
create table public.excel_efficiency_tests(id uuid primary key, current_version_id uuid, status text, title text, language text, current_version_number int, auto_publish_results boolean);
create table public.excel_efficiency_versions(id uuid primary key default gen_random_uuid(), test_id uuid, version_number int, passing_marks numeric, working_matter_snapshot jsonb,
  title text, language text, description text, instructions_markdown text, question_count int, maximum_marks numeric, duration_options int[], created_by uuid,
  delivery_pdf boolean, delivery_onscreen boolean, student_question_toggle boolean, model_answer_snapshot jsonb);
create table public.excel_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, marks numeric, instruction text, display_order int, solution text);
create table public.excel_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, additional_criteria jsonb, created_at timestamptz default now(), unique(version_id, question_id));
create table public.excel_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, selected_duration_seconds int, status text, started_at timestamptz, original_document_snapshot jsonb, document_autosave jsonb, final_document_snapshot jsonb, result jsonb, evaluation_status text, evaluated_at timestamptz, result_published_at timestamptz, submitted_at timestamptz, updated_at timestamptz);
create table public.excel_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, updated_at timestamptz);
`);
  for (const name of ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "202610251730_excel_efficiency_cell_format_extras.sql", "202610252200_excel_efficiency_workspace_features.sql", "202610252300_excel_efficiency_full_home_tab.sql", "202610311000_excel_efficiency_autofit_marking.sql"]) {
    await live.exec(await read(`supabase/migrations/${name}`));
  }
  await live.exec(await fn("202608260024_excel_efficiency_functions.sql", "assert_excel_efficiency_working_matter"));
  // 202611081400 raised both sheet checks' row limit from 200 to 300 (by rewriting each function's text).
  await live.exec(`do $mig$ declare f text; begin
    foreach f in array array['public.assert_excel_efficiency_document_schema(jsonb)', 'public.assert_excel_efficiency_working_matter(jsonb)'] loop
      execute regexp_replace(pg_get_functiondef(f::regprocedure), '\\m200\\M', '300', 'g'); end loop; end $mig$;`);
  // The marking itself is tested above; here the migration's closing report only has to run.
  await live.exec(`create or replace function public.excel_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
`);
  const v1 = await json("tests/fixtures/excel-test9-initial.json");
  await live.query("insert into public.excel_efficiency_tests(id,current_version_id,title,language,current_version_number,auto_publish_results) values('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','EFFICIENCY TEST 9','English',1,false)");
  await live.query("insert into public.excel_efficiency_versions(id,test_id,version_number,passing_marks,working_matter_snapshot,title,language,duration_options,delivery_pdf,delivery_onscreen,student_question_toggle) values('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001',1,9,$1::jsonb,'EFFICIENCY TEST 9','English','{600,900,1200}',false,true,true)", [JSON.stringify(v1)]);
  await live.query("insert into public.excel_efficiency_questions(version_id,question_number,marks,instruction) values('90000000-0000-0000-0000-000000000002',1,2,'old question')");

  const migration = await read("supabase/migrations/202611261200_excel_test9_v2_new_questions.sql");
  await live.exec(migration);
  const { rows: [current] } = await live.query("select t.current_version_number n, t.auto_publish_results pub, v.id, v.working_matter_snapshot ws, v.model_answer_snapshot ms from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id = t.current_version_id");
  assert.equal(current.n, 2);
  assert.equal(current.pub, true);
  const { rows: stored } = await live.query("select q.question_number n, q.marks::float m, r.additional_criteria c from public.excel_efficiency_questions q join public.excel_efficiency_grading_rules r on r.question_id = q.id where q.version_id = $1 order by 1", [current.id]);
  assert.equal(stored.length, 15);
  const start = { schemaVersion: "3", rows: current.ws.rows, cols: current.ws.cols, cells: current.ws.cells, merges: [], sheet: {}, operations: [], savedAt: "2026-11-26T00:00:00.000Z" };
  for (const { n, m, c } of stored) {
    assert.equal(m, rules[n - 1].marks, `Q${n} marks`);
    for (const criterion of c) assert.equal(await passes(current.ms, criterion), true, `Q${n} on the stored solved sheet: ${JSON.stringify(criterion).slice(0, 120)}`);
    assert.ok((await Promise.all(c.map((criterion) => passes(start, criterion)))).includes(false), `Q${n} on the starting sheet`);
  }
  validateExcelDocument(current.ms);
  await live.exec(migration);
  const { rows: [{ versions }] } = await live.query("select count(*)::int versions from public.excel_efficiency_versions");
  assert.equal(versions, 2);
});
