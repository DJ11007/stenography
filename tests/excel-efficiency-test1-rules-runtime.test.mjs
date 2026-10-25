import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// English EXCEL EFFICIENCY TEST 1 is marked by rule criteria (migrations 202610251700 and 202610251710).
// This runs my attempt -- saved from the new Excel 2013-like workspace after doing every question -- and
// changed copies of it through the real SQL marking, and a whole submission through the real submit.

const version = "f157a8ee-0431-40d9-8395-0665e7fa32a7", testId = "fc1dff33-4fc4-4a2e-8b4d-66ff19be0e52";
const QUESTIONS = ["4f3679c1-3142-4b5f-bccc-aabdfb5e1ea4", "0d5e9e21-a6bd-4f86-9170-f213489f44ac", "8eb6bcef-9ec4-4735-ab35-63786911f9ee", "7d5730c7-a11a-4962-9535-f25fc1238887", "0aa62302-037f-4789-a535-c5a923c6d94a", "a72bd2f7-0046-4fd5-9268-d06c9f4715a9", "142779a8-b156-48e4-a412-1f54abffb982", "5a878c93-787a-4847-8d5c-d28696774342", "0947bc43-6c81-41d5-b4f5-a9d31c5864c0", "72583430-5830-4517-b20d-1e85f7f1c2a3"];
const STUDENT = "11111111-1111-1111-1111-111111111111";
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const model = await read("excel-test1-model.json"), initial = await read("excel-test1-initial.json");
const clone = (value) => JSON.parse(JSON.stringify(value));

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated; create role service_role;
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.evaluate_excel_grading_rule(d jsonb, t text, o text, v jsonb, a numeric, p numeric) returns numeric language sql immutable as $$select 0::numeric$$;
create table public.excel_efficiency_tests(id uuid primary key, current_version_id uuid, status text);
create table public.excel_efficiency_versions(id uuid primary key, test_id uuid, passing_marks numeric, working_matter_snapshot jsonb);
create table public.excel_efficiency_questions(id uuid primary key, version_id uuid, question_number int, marks numeric);
create table public.excel_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, created_at timestamptz default now(), unique(version_id, question_id));
create table public.excel_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, selected_duration_seconds int, status text, started_at timestamptz, original_document_snapshot jsonb, document_autosave jsonb, final_document_snapshot jsonb, result jsonb, evaluation_status text, evaluated_at timestamptz, result_published_at timestamptz, submitted_at timestamptz, updated_at timestamptz);
create table public.excel_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, updated_at timestamptz);
insert into public.excel_efficiency_tests values('${testId}','${version}','published');
insert into public.excel_efficiency_versions values('${version}','${testId}',10,null);
insert into public.excel_efficiency_questions values ${QUESTIONS.map((id, index) => `('${id}','${version}',${index + 1},2.5)`).join(",")};
insert into auth.state values('${STUDENT}');
`);
  for (const name of ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "202610251710_excel_efficiency_test1_rules.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  return db;
}

async function marks(document) {
  const { rows } = await (await database()).query(
    `select q.question_number as n, public.excel_efficiency_score_question($1::jsonb, q.version_id, q.id, q.marks)::float as awarded from public.excel_efficiency_questions q where q.version_id=$2 order by q.question_number`,
    [JSON.stringify(document), version]);
  return rows.map((row) => row.awarded);
}
const total = (list) => Math.round(list.reduce((sum, value) => sum + value, 0) * 100) / 100;

test("my attempt from the workspace scores 25/25, and the untouched starting sheet scores 0", async () => {
  assert.deepEqual(await marks(model), Array(10).fill(2.5));
  assert.equal(total(await marks(initial)), 0);
});

test("each part is marked on its own", async () => {
  const noAcross = clone(model); noAcross.merges = noAcross.merges.filter((range) => range !== "A30:L30");
  assert.equal((await marks(noAcross))[1], 1.67, "Q2 without one Merge Across row loses part a");
  const blackA27 = clone(model); blackA27.cells.A27.fontColor = null;
  assert.equal((await marks(blackA27))[0], 1.67, "Q1 without the red font loses part b");
  const darkRed = clone(model); darkRed.cells.A27.fontColor = "C00000";
  assert.equal((await marks(darkRed))[0], 2.5, "Dark Red counts as red");
  const notMiddle = clone(model); delete notMiddle.cells.A6.vAlign;
  assert.equal((await marks(notMiddle))[2], 1.67, "Q3 needs Middle Align on each range");
  const noPainter = clone(model); noPainter.cells.B21 = { ...noPainter.cells.B21, bold: false, fillColor: null };
  assert.equal((await marks(noPainter))[3], 1.67, "Q4 needs B5's formatting on each target");
  const wrongTotal = clone(model); wrongTotal.cells.I21.value = 11498;
  assert.equal((await marks(wrongTotal))[5], 1.87, "Q6 counts each total (part c is 0.63)");
  const portrait = clone(model); portrait.sheet.orientation = "portrait";
  assert.equal((await marks(portrait))[8], 1.25, "Q9 a landscape, b Legal");
  const centreHeader = clone(model); centreHeader.sheet.header = { center: "&[Page]" };
  assert.equal((await marks(centreHeader))[7], 0, "Q8 wants the page number in the right section");
  const absolutePrintArea = clone(model); absolutePrintArea.sheet.printArea = "$A$1:$L$31";
  assert.equal((await marks(absolutePrintArea))[6], 2.5, "a print area with $ signs is the same range");
});

test("submitting marks the attempt at once and publishes the result (all questions have rules)", async () => {
  const pg = await database();
  const attempt = "22222222-2222-2222-2222-222222222222";
  await pg.exec(`insert into public.excel_efficiency_attempts(id,test_id,version_id,student_id,selected_duration_seconds,status,started_at,original_document_snapshot) values('${attempt}','${testId}','${version}','${STUDENT}',600,'active',now(),'${JSON.stringify(initial).replace(/'/g, "''")}');
    insert into public.excel_efficiency_question_scores(attempt_id,question_id,maximum_marks) select '${attempt}', id, 2.5 from public.excel_efficiency_questions;`);
  await pg.query("select public.submit_excel_efficiency_document($1::uuid, $2::jsonb)", [attempt, JSON.stringify(model)]);
  const { rows } = await pg.query("select status, evaluation_status, (result->>'marks')::float marks, (result->>'passed')::boolean passed from public.excel_efficiency_attempts where id=$1", [attempt]);
  assert.deepEqual(rows[0], { status: "completed", evaluation_status: "published", marks: 25, passed: true });
  const parts = await pg.query("select public.excel_efficiency_question_parts($1::jsonb, $2::uuid, $3::uuid) p", [JSON.stringify(model), version, QUESTIONS[5]]);
  assert.deepEqual(parts.rows[0].p.map((part) => part.maximum), [0.62, 0.62, 0.63, 0.63]);
});

test("the saved-sheet check accepts version 3 sheets (merges, page settings, new cell fields) and still version 2", async () => {
  const pg = await database();
  await pg.query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify(model)]);
  await pg.query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify({ ...clone(initial), schemaVersion: "2", merges: undefined, sheet: undefined })]);
  const badMerge = clone(model); badMerge.merges.push("A1-B2");
  await assert.rejects(pg.query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify(badMerge)]), /Invalid merged range/);
  const badPaper = clone(model); badPaper.sheet.paperSize = "Huge";
  await assert.rejects(pg.query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify(badPaper)]), /Invalid paper size/);
});
