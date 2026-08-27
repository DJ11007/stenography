import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const schemaPath = new URL("../supabase/migrations/202608260023_excel_efficiency_module.sql", import.meta.url);
const functionsPath = new URL("../supabase/migrations/202608260024_excel_efficiency_functions.sql", import.meta.url);
const accessControlPath = new URL("../supabase/migrations/202608260028_student_access_control.sql", import.meta.url);
const accessGatePath = new URL("../supabase/migrations/202608270036_excel_efficiency_access_control_gate.sql", import.meta.url);
const admin = "31000000-0000-0000-0000-000000000001";
const student = "31000000-0000-0000-0000-000000000002";
const lockedStudent = "31000000-0000-0000-0000-000000000003";

const workingMatter = { schemaVersion: 1, language: "English", rows: 2, cols: 2, cells: { A1: { value: "Item", formula: null, bold: true, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: "left" }, B1: { value: 10, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "Number", align: "right" } } };

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
insert into auth.state values('${admin}');
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean,updated_at timestamptz not null default now());
insert into public.profiles values('${admin}','admin',true),('${student}','student',true),('${lockedStudent}','student',false);
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active)$$;
create table public.test_attempts(student_id uuid,started_at timestamptz,result jsonb);
create table public.word_efficiency_attempts(student_id uuid,started_at timestamptz,result jsonb);
`);
  await db.exec(await readFile(schemaPath, "utf8"));
  await db.exec(await readFile(functionsPath, "utf8"));
  await db.exec(await readFile(accessControlPath, "utf8"));
  await db.exec(await readFile(accessGatePath, "utf8"));
  return db;
}
const asAdmin = (db) => db.exec(`update auth.state set uid='${admin}'`);
const asStudent = (db, id = student) => db.exec(`update auth.state set uid='${id}'`);

function testPayload(overrides = {}) {
  return {
    title: "Excel Data Entry Practice",
    slug: `excel-practice-${Math.random().toString(36).slice(2, 8)}`,
    language: "English",
    description: "Practice sheet",
    instructions_markdown: "1. Enter the values as instructed.",
    question_count: 2,
    maximum_marks: 8,
    duration_options: [600],
    passing_marks: "",
    questions: [
      { number: 1, instruction: "Enter 500 in cell A1.", marks: 3, section: null, display_order: 1, is_visible: true },
      { number: 2, instruction: "Apply SUM in B1.", marks: 5, section: null, display_order: 2, is_visible: true },
    ],
    publish: true,
    working_matter_snapshot: workingMatter,
    ...overrides,
  };
}

test("an admin can author, publish, and re-read an Excel Efficiency test", async () => {
  const db = await database();
  await asAdmin(db);
  const { rows } = await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]);
  const testId = rows[0].id;
  assert.ok(testId);
  const test = (await db.query("select status,current_version_number from public.excel_efficiency_tests where id=$1", [testId])).rows[0];
  assert.equal(test.status, "published");
  assert.equal(test.current_version_number, 1);
  const version = (await db.query("select question_count,maximum_marks,working_matter_snapshot from public.excel_efficiency_versions where test_id=$1", [testId])).rows[0];
  assert.equal(version.question_count, 2);
  assert.equal(Number(version.maximum_marks), 8);
  assert.equal(version.working_matter_snapshot.cells.A1.value, "Item");
  await db.close();
});

test("a non-admin cannot author a test", async () => {
  const db = await database();
  await asStudent(db);
  await assert.rejects(db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]), /not authorized/);
  await db.close();
});

test("mismatched question count or marks totals are rejected before any row is written", async () => {
  const db = await database();
  await asAdmin(db);
  await assert.rejects(db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload({ maximum_marks: 999 }))]), /question count or marks mismatch/);
  await db.close();
});

async function publishedTestId(db, extraRule) {
  await asAdmin(db);
  const { rows } = await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]);
  const testId = rows[0].id;
  const version = (await db.query("select id from public.excel_efficiency_tests where id=$1", [testId])).rows[0];
  const versionId = (await db.query("select current_version_id from public.excel_efficiency_tests where id=$1", [testId])).rows[0].current_version_id;
  if (extraRule) await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [versionId, JSON.stringify(extraRule)]);
  return { testId, versionId };
}

test("grading rules can be authored before any attempt exists, and become immutable once one is prepared", async () => {
  const db = await database();
  const { versionId } = await publishedTestId(db);
  const rules = [{ questionNumber: 1, exactTarget: "cells.A1.value", expectedOperation: "value-entry", expectedValue: "500", allocatedMarks: 3, partialMarks: 1 }];
  await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [versionId, JSON.stringify(rules)]);
  const saved = (await db.query("select exact_target,allocated_marks from public.excel_efficiency_grading_rules where version_id=$1", [versionId])).rows;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].exact_target, "cells.A1.value");
  await asStudent(db);
  await db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [(await db.query("select test_id from public.excel_efficiency_versions where id=$1", [versionId])).rows[0].test_id]);
  await asAdmin(db);
  await assert.rejects(db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [versionId, JSON.stringify(rules)]), /immutable after an attempt is prepared/);
  await db.close();
});

test("a locked (inactive) student is rejected before the test lookup runs", async () => {
  const db = await database();
  const { testId } = await publishedTestId(db);
  await asStudent(db, lockedStudent);
  await assert.rejects(db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testId]), /active student account required/);
  await db.close();
});

test("an active student can prepare an attempt seeded from the working matter, with ungraded scores for every question", async () => {
  const db = await database();
  const { testId } = await publishedTestId(db);
  await asStudent(db);
  const { rows } = await db.query("select public.prepare_excel_efficiency_attempt($1,600,true) as id", [testId]);
  const attemptId = rows[0].id;
  const attempt = (await db.query("select status,snapshot,original_document_snapshot from public.excel_efficiency_attempts where id=$1", [attemptId])).rows[0];
  assert.equal(attempt.status, "active");
  assert.equal(attempt.snapshot.question_count, 2);
  assert.equal(attempt.original_document_snapshot.cells.A1.value, "Item");
  assert.equal(attempt.original_document_snapshot.schemaVersion, "2");
  const scores = (await db.query("select grading_status from public.excel_efficiency_question_scores where attempt_id=$1", [attemptId])).rows;
  assert.equal(scores.length, 2);
  assert.ok(scores.every((score) => score.grading_status === "ungraded"));
  await db.close();
});

test("an exact rule match auto-awards full marks at submission and an unrelated question stays manual", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "cells.A1.value", expectedOperation: "value-entry", expectedValue: "500", allocatedMarks: 3, partialMarks: 1 }];
  await asAdmin(db);
  const { rows: created } = await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]);
  const testId = created[0].id;
  const versionId = (await db.query("select current_version_id from public.excel_efficiency_tests where id=$1", [testId])).rows[0].current_version_id;
  await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [versionId, JSON.stringify(rules)]);
  await asStudent(db);
  const { rows: prepared } = await db.query("select public.prepare_excel_efficiency_attempt($1,600,true) as id", [testId]);
  const attemptId = prepared[0].id;
  const original = (await db.query("select original_document_snapshot from public.excel_efficiency_attempts where id=$1", [attemptId])).rows[0].original_document_snapshot;
  const document = { ...original, cells: { ...original.cells, A1: { ...original.cells.A1, value: 500 } }, operations: ["value-entry"], savedAt: new Date().toISOString() };
  await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)", [attemptId, JSON.stringify(document)]);
  const scores = (await db.query("select question_number,awarded_marks,grading_status,graded_by from public.excel_efficiency_question_scores where attempt_id=$1 order by question_number", [attemptId])).rows;
  assert.equal(Number(scores[0].awarded_marks), 3);
  assert.equal(scores[0].grading_status, "graded");
  assert.equal(scores[0].graded_by, null);
  assert.equal(scores[1].awarded_marks, null);
  assert.equal(scores[1].grading_status, "ungraded");
  const attempt = (await db.query("select status from public.excel_efficiency_attempts where id=$1", [attemptId])).rows[0];
  assert.equal(attempt.status, "submitted");
  await db.close();
});

test("an operation-only near miss awards configured partial marks, and no match at all awards zero", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "cells.A1.value", expectedOperation: "value-entry", expectedValue: "500", allocatedMarks: 3, partialMarks: 1 }];
  await asAdmin(db);
  const { rows: created } = await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]);
  const testId = created[0].id;
  const versionId = (await db.query("select current_version_id from public.excel_efficiency_tests where id=$1", [testId])).rows[0].current_version_id;
  await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [versionId, JSON.stringify(rules)]);
  await asStudent(db);
  const { rows: prepared } = await db.query("select public.prepare_excel_efficiency_attempt($1,600,true) as id", [testId]);
  const attemptId = prepared[0].id;
  const original = (await db.query("select original_document_snapshot from public.excel_efficiency_attempts where id=$1", [attemptId])).rows[0].original_document_snapshot;
  const nearMiss = { ...original, cells: { ...original.cells, A1: { ...original.cells.A1, value: 999 } }, operations: ["value-entry"], savedAt: new Date().toISOString() };
  await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)", [attemptId, JSON.stringify(nearMiss)]);
  const partial = (await db.query("select awarded_marks from public.excel_efficiency_question_scores where attempt_id=$1 and question_number=1", [attemptId])).rows[0];
  assert.equal(Number(partial.awarded_marks), 1);

  const { rows: prepared2 } = await (async () => { await asAdmin(db); const p = await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(testPayload())]); const vid = (await db.query("select current_version_id from public.excel_efficiency_tests where id=$1", [p.rows[0].id])).rows[0].current_version_id; await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)", [vid, JSON.stringify(rules)]); await asStudent(db); return db.query("select public.prepare_excel_efficiency_attempt($1,600,true) as id", [p.rows[0].id]); })();
  const attempt2 = prepared2[0].id;
  const original2 = (await db.query("select original_document_snapshot from public.excel_efficiency_attempts where id=$1", [attempt2])).rows[0].original_document_snapshot;
  const noMatch = { ...original2, operations: [], savedAt: new Date().toISOString() };
  await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)", [attempt2, JSON.stringify(noMatch)]);
  const zero = (await db.query("select awarded_marks from public.excel_efficiency_question_scores where attempt_id=$1 and question_number=1", [attempt2])).rows[0];
  assert.equal(Number(zero.awarded_marks), 0);
  await db.close();
});

test("admin grading publishes a locked total, percentage, and pass/fail outcome that the student can then read", async () => {
  const db = await database();
  const { testId } = await publishedTestId(db);
  await asStudent(db);
  const { rows: prepared } = await db.query("select public.prepare_excel_efficiency_attempt($1,600,true) as id", [testId]);
  const attemptId = prepared[0].id;
  const original = (await db.query("select original_document_snapshot from public.excel_efficiency_attempts where id=$1", [attemptId])).rows[0].original_document_snapshot;
  await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)", [attemptId, JSON.stringify({ ...original, operations: [], savedAt: new Date().toISOString() })]);
  const pending = (await db.query("select public.get_excel_efficiency_attempt_result($1) as r", [attemptId])).rows[0].r;
  assert.equal(pending.status, "pending");
  const questionIds = (await db.query("select question_id from public.excel_efficiency_question_scores where attempt_id=$1 order by question_number", [attemptId])).rows.map((r) => r.question_id);
  await asAdmin(db);
  const payload = { scores: [{ questionId: questionIds[0], awardedMarks: 3, feedback: "Good" }, { questionId: questionIds[1], awardedMarks: 4, feedback: "Close" }], overallFeedback: "Well done overall.", privateNote: "" };
  const publishResult = (await db.query("select public.save_excel_efficiency_grading($1,$2::jsonb,true) as r", [attemptId, JSON.stringify(payload)])).rows[0].r;
  assert.equal(publishResult.status, "published");
  assert.equal(Number(publishResult.marks), 7);
  await assert.rejects(db.query("select public.save_excel_efficiency_grading($1,$2::jsonb,false)", [attemptId, JSON.stringify(payload)]), /published result is immutable/);
  await asStudent(db);
  const published = (await db.query("select public.get_excel_efficiency_attempt_result($1) as r", [attemptId])).rows[0].r;
  assert.equal(published.status, "published");
  assert.equal(Number(published.marksObtained), 7);
  assert.equal(published.questions.length, 2);
  await db.close();
});

test("a student locked via the shared access-control system is rejected before the test lookup runs", async () => {
  const db = await database();
  const { testId } = await publishedTestId(db);
  await asAdmin(db);
  await db.query("select public.admin_set_student_locked($1,true)", [student]);
  await asStudent(db);
  await assert.rejects(db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testId]), /test access is currently locked/);
  await asAdmin(db);
  await db.query("select public.admin_set_student_locked($1,false)", [student]);
  await asStudent(db);
  await assert.doesNotReject(db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testId]));
  await db.close();
});

test("a student who has exhausted an admin-set test limit is rejected the same way a locked student is, counting Excel attempts toward the limit", async () => {
  const db = await database();
  const { testId } = await publishedTestId(db);
  await asAdmin(db);
  await db.query("select public.admin_set_student_access($1,1,null,0,false)", [student]);
  await asStudent(db);
  await db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testId]);
  await assert.rejects(db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testId]), /test access is currently locked/);
  await asAdmin(db);
  const status = (await db.query("select tests_used_in_window,tests_remaining from public.student_access_status($1)", [student])).rows[0];
  assert.equal(Number(status.tests_used_in_window), 1);
  assert.equal(Number(status.tests_remaining), 0);
  await db.close();
});

test("deleting a test with attempts is refused; deleting one with none succeeds", async () => {
  const db = await database();
  const { testId: testWithAttempts } = await publishedTestId(db);
  await asStudent(db);
  await db.query("select public.prepare_excel_efficiency_attempt($1,600,true)", [testWithAttempts]);
  await asAdmin(db);
  const blocked = (await db.query("select public.delete_excel_efficiency_test($1) as ok", [testWithAttempts])).rows[0].ok;
  assert.equal(blocked, false);
  const { testId: freshTest } = await publishedTestId(db);
  const removed = (await db.query("select public.delete_excel_efficiency_test($1) as ok", [freshTest])).rows[0].ok;
  assert.equal(removed, true);
  const remaining = (await db.query("select id from public.excel_efficiency_tests where id=$1", [freshTest])).rows;
  assert.equal(remaining.length, 0);
  await db.close();
});
