import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { cellsToRanges, diffExcelDocuments, excelQuestionRules, excelRuleGroups, splitMarks } from "../lib/excel-document-diff.ts";

// The Excel Model Answer page (migration 202610291000): the admin's edits become rules, the model answer is run
// through them, automatic publishing is gated on that check, and a corrected rule re-marks submitted attempts.
// Runs the real SQL (migrations 202610251700, 202610251730, 202610291000) on a small scaffold.

const testId = "10000000-0000-0000-0000-000000000001", version = "10000000-0000-0000-0000-000000000002", STUDENT = "10000000-0000-0000-0000-000000000009";
const Q = ["10000000-0000-0000-0000-0000000000a1", "10000000-0000-0000-0000-0000000000a2"];
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
create table public.excel_efficiency_versions(id uuid primary key, test_id uuid, version_number int, passing_marks numeric, working_matter_snapshot jsonb);
create table public.excel_efficiency_questions(id uuid primary key, version_id uuid, question_number int, marks numeric);
create table public.excel_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, created_at timestamptz default now(), unique(version_id, question_id));
create table public.excel_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, selected_duration_seconds int, status text, started_at timestamptz, original_document_snapshot jsonb, document_autosave jsonb, final_document_snapshot jsonb, result jsonb, evaluation_status text, evaluated_at timestamptz, result_published_at timestamptz, submitted_at timestamptz, updated_at timestamptz);
create table public.excel_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, updated_at timestamptz);
insert into public.excel_efficiency_tests values('${testId}','${version}','published');
insert into public.excel_efficiency_versions values('${version}','${testId}',1,10,null);
insert into public.excel_efficiency_questions values('${Q[0]}','${version}',1,10),('${Q[1]}','${version}',2,5);
insert into auth.state values('${STUDENT}');
`);
  for (const name of ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "202610251730_excel_efficiency_cell_format_extras.sql", "202610291000_excel_efficiency_model_answer_and_auto_grading.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  return db;
}
const score = async (document, question = Q[0], marks = 10) => Number((await (await database()).query("select public.excel_efficiency_score_question($1::jsonb,$2::uuid,$3::uuid,$4::numeric)::float as s", [JSON.stringify(document), version, question, marks])).rows[0].s);
async function saveRules(number, marks, groups) {
  await (await database()).query("select public.save_excel_efficiency_question_rules($1::uuid,$2::int,$3::jsonb)", [version, number, JSON.stringify(excelQuestionRules(marks, groups))]);
}

test("cells become the fewest rectangles, and marks split to the cent", () => {
  assert.deepEqual(cellsToRanges(["A28", "A29", "A30", "A31"]), ["A28:A31"]);
  assert.deepEqual(cellsToRanges(["A1", "B1", "A2", "B2", "D5"]), ["A1:B2", "D5"]);
  assert.deepEqual(cellsToRanges(["B2", "D2"]), ["B2", "D2"]);
  assert.deepEqual(splitMarks(2.5, 3), [0.83, 0.83, 0.84]);
  assert.deepEqual(splitMarks(10, 4), [2.5, 2.5, 2.5, 2.5]);
  assert.deepEqual(splitMarks(7, 1), [7]);
});

test("the changes between the starting sheet and a solved sheet cover formatting, content, merges and page settings", () => {
  const { changes, unsupported } = diffExcelDocuments(initial, model);
  const kinds = new Set(changes.map((change) => change.kind));
  assert.deepEqual([...kinds].sort(), ["cell", "merge", "sheet", "value"]);
  assert.ok(changes.some((change) => change.kind === "merge" && change.range === "A30:L30"));
  assert.ok(changes.some((change) => change.kind === "sheet" && change.path === "orientation"));
  assert.ok(changes.some((change) => change.kind === "sheet" && change.path === "header.right"));
  assert.ok(changes.some((change) => change.kind === "cell" && change.cell === "A27" && change.keys.includes("fontColor")));
  assert.deepEqual(unsupported, []);
  assert.deepEqual(diffExcelDocuments(model, model), { changes: [], unsupported: [] });
});

test("something the rules cannot check is named, not silently dropped", () => {
  const changed = clone(model); changed.sheet.charts = [{ id: "c1", type: "column", range: "A1:B2", title: "T", anchor: "D1" }];
  assert.deepEqual(diffExcelDocuments(model, changed).unsupported, ["charts"]);
});

test("rules built from the solved sheet give the solved sheet full marks and the starting sheet none", async () => {
  const { changes } = diffExcelDocuments(initial, model);
  const groups = excelRuleGroups(model, changes);
  assert.ok(groups.length > 5, "each independent change is a part");
  await saveRules(1, 10, groups);
  assert.equal(await score(model), 10);
  assert.equal(await score(initial), 0);
  const portrait = clone(model); portrait.sheet.orientation = "portrait";
  const partial = await score(portrait);
  assert.ok(partial > 0 && partial < 10, `losing one setting loses only its part (${partial})`);
  const noGrid = clone(model); noGrid.sheet.gridlines = true;
  assert.ok((await score(noGrid)) < 10);
});

test("a different way to the same result still earns the marks (dark red, a number typed as text, General stored empty)", async () => {
  const typed = clone(model); typed.cells.I5.value = "6000";
  assert.equal(await score(typed), 10);
  const noFormat = clone(model); for (const cell of Object.values(noFormat.cells)) delete cell.numberFormat;
  assert.equal(await score(noFormat), 10);
});

test("the Auto-grading check: the model answer must earn every rule, and every question needs rules", async () => {
  const pg = await database();
  await pg.query("select public.save_excel_efficiency_model_answer($1::uuid,$2::jsonb)", [version, JSON.stringify(model)]);
  await saveRules(2, 5, excelRuleGroups(model, [{ kind: "sheet", path: "gridlines" }]));
  const check = (await pg.query("select public.check_excel_efficiency_auto_grading($1::uuid) c", [testId])).rows[0].c;
  assert.equal(check.hasModelAnswer, true);
  assert.equal(check.ready, true);
  assert.deepEqual(check.questions.map((q) => [q.number, q.ok, q.modelGets]), [[1, true, 10], [2, true, 5]]);
  // a rule the model answer itself does not satisfy
  await saveRules(2, 5, excelRuleGroups({ ...clone(model), sheet: { ...clone(model).sheet, gridlines: true } }, [{ kind: "sheet", path: "gridlines" }]));
  const broken = (await pg.query("select public.check_excel_efficiency_auto_grading($1::uuid) c", [testId])).rows[0].c;
  assert.equal(broken.ready, false);
  assert.equal(broken.questions[1].ok, false);
  await assert.rejects(pg.query("select public.set_excel_efficiency_auto_publish($1::uuid, true)", [testId]), /full marks on the saved model answer/);
  await pg.query("select public.set_excel_efficiency_auto_publish($1::uuid, false)", [testId]);
  // a question with no rule
  await pg.query("select public.save_excel_efficiency_question_rules($1::uuid,2,'[]'::jsonb)", [version]);
  const missing = (await pg.query("select public.check_excel_efficiency_auto_grading($1::uuid) c", [testId])).rows[0].c;
  assert.equal(missing.questions[1].hasRule, false);
  assert.equal(missing.ready, false);
});

test("saving one question's rules leaves the other questions' rules alone, and refuses more marks than the question has", async () => {
  const pg = await database();
  await saveRules(2, 5, excelRuleGroups(model, [{ kind: "sheet", path: "gridlines" }]));
  const before = (await pg.query("select count(*)::int n from public.excel_efficiency_grading_rules where question_id=$1", [Q[0]])).rows[0].n;
  await saveRules(2, 5, excelRuleGroups(model, [{ kind: "sheet", path: "headings" }]));
  assert.equal((await pg.query("select count(*)::int n from public.excel_efficiency_grading_rules where question_id=$1", [Q[0]])).rows[0].n, before);
  await assert.rejects(pg.query("select public.save_excel_efficiency_question_rules($1::uuid,2,$2::jsonb)", [version, JSON.stringify([{ allocatedMarks: 6, partLabel: null, additionalCriteria: [{ rule: "sheet", path: "gridlines", equals: false }] }])]), /exceed question marks/);
});

test("Reset clears the model answer and the rules; Re-grade marks submitted attempts again and refreshes a published result", async () => {
  const pg = await database();
  await saveRules(1, 10, excelRuleGroups(model, diffExcelDocuments(initial, model).changes));
  const attempt = "20000000-0000-0000-0000-000000000001";
  await pg.exec(`insert into public.excel_efficiency_attempts(id,test_id,version_id,student_id,selected_duration_seconds,status,final_document_snapshot,result,updated_at) values('${attempt}','${testId}','${version}','${STUDENT}',600,'completed','${JSON.stringify(model).replace(/'/g, "''")}'::jsonb,'{"marks":0,"maximum_marks":15,"percentage":0,"passed":false}'::jsonb,now());
    insert into public.excel_efficiency_question_scores(attempt_id,question_id,maximum_marks,awarded_marks,grading_status) values('${attempt}','${Q[0]}',10,0,'graded'),('${attempt}','${Q[1]}',5,0,'graded');`);
  const out = (await pg.query("select public.regrade_excel_efficiency_version($1::uuid) r", [version])).rows[0].r;
  assert.equal(out.attemptsExamined, 1);
  assert.equal(out.scoresChanged, 2, "Q1 (new rules) and Q2 (rule left by the previous test) both change");
  const row = (await pg.query("select (result->>'marks')::float marks, (result->>'passed')::boolean passed from public.excel_efficiency_attempts where id=$1", [attempt])).rows[0];
  assert.deepEqual(row, { marks: 15, passed: true });
  await pg.query("select public.reset_excel_efficiency_model_answer($1::uuid)", [version]);
  assert.equal((await pg.query("select count(*)::int n from public.excel_efficiency_grading_rules where version_id=$1", [version])).rows[0].n, 0);
  assert.equal((await pg.query("select model_answer_snapshot from public.excel_efficiency_versions where id=$1", [version])).rows[0].model_answer_snapshot, null);
});

test("a new version of the test keeps the model answer when its working sheet is unchanged, and not when it changed", async () => {
  const pg = await database();
  await pg.query("update public.excel_efficiency_versions set working_matter_snapshot=$1::jsonb, model_answer_snapshot=$2::jsonb where id=$3", [JSON.stringify(initial), JSON.stringify(model), version]);
  await pg.query("insert into public.excel_efficiency_versions(id,test_id,version_number,working_matter_snapshot) values('10000000-0000-0000-0000-0000000000b1',$1,2,$2::jsonb)", [testId, JSON.stringify(initial)]);
  await pg.query("insert into public.excel_efficiency_versions(id,test_id,version_number,working_matter_snapshot) values('10000000-0000-0000-0000-0000000000b2',$1,3,$2::jsonb)", [testId, JSON.stringify(model)]);
  const rows = (await pg.query("select version_number, model_answer_snapshot is not null as has from public.excel_efficiency_versions order by version_number")).rows;
  assert.deepEqual(rows.map((r) => r.has), [true, true, false]);
});

test("the migration is one transaction with balanced dollar quotes", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202610291000_excel_efficiency_model_answer_and_auto_grading.sql", import.meta.url), "utf8");
  assert.match(sql, /^--[\s\S]*?\nbegin;/);
  assert.match(sql, /commit;\s*$/);
  assert.equal((sql.match(/\$function\$/g) ?? []).length % 2, 0);
});
