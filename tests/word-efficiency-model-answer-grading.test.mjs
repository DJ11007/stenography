import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const baseGradingMigrationPath = new URL("../supabase/migrations/202608250017_word_efficiency_automatic_grading.sql", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql", import.meta.url);
const admin = "51000000-0000-0000-0000-000000000001";
const student = "51000000-0000-0000-0000-000000000002";
const testId = "51000000-0000-0000-0000-000000000003";
const version = "51000000-0000-0000-0000-000000000004";
const questionMulti = "51000000-0000-0000-0000-000000000005";
const questionOther = "51000000-0000-0000-0000-000000000006";

function attemptRow(id, startedAt) {
  return `insert into public.word_efficiency_attempts(id,test_id,version_id,student_id,status,selected_duration_seconds,started_at,snapshot,original_document_snapshot)values('${id}','${testId}','${version}','${student}','active',600,'${startedAt}'::timestamptz,'{}'::jsonb,'{"schemaVersion":"1","blocks":[{"id":"block-6","type":"paragraph","alignment":"left","runs":[{"text":"Hello"}]}],"savedAt":"1970-01-01T00:00:00.000Z"}'::jsonb);`;
}
function scoreRows(attemptId) {
  return `insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)values('${attemptId}','${questionMulti}',1,5,'ungraded'),('${attemptId}','${questionOther}',2,5,'ungraded');`;
}

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true),('${student}','student',true);
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='student'and is_active)$$;
create function public.is_aal2_admin()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='admin')$$;
create function public.word_efficiency_default_editor_capabilities()returns jsonb language sql immutable as $$select '{}'::jsonb$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb)returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb)returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create table public.word_efficiency_tests(id uuid primary key);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,title text,language text,maximum_marks numeric,passing_marks numeric,editor_capabilities jsonb,model_answer_snapshot jsonb);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,instruction text,display_order int,question_number int,marks numeric default 5);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,status text,selected_duration_seconds int,started_at timestamptz,snapshot jsonb,result jsonb,submitted_at timestamptz,updated_at timestamptz,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text,grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric);
insert into public.word_efficiency_tests values('${testId}');
insert into public.word_efficiency_versions(id,test_id,title,language,maximum_marks,passing_marks,editor_capabilities)values('${version}','${testId}','Practice Test','English',10,5,'{}'::jsonb);
insert into public.word_efficiency_questions(id,version_id,instruction,display_order,question_number,marks)values('${questionMulti}','${version}','Bold, italic and underline paragraph six',1,1,5),('${questionOther}','${version}','Write a summary',2,2,5);
`);
  await db.exec(await readFile(baseGradingMigrationPath, "utf8"));
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("update auth.state set uid=$1", [id]);

test("save_word_efficiency_model_answer requires an admin and persists the document on the version", async () => {
  const db = await database();
  await asUser(db, student);
  await assert.rejects(db.query("select public.save_word_efficiency_model_answer($1,$2::jsonb)", [version, JSON.stringify({ schemaVersion: "2" })]), /not authorized/);
  await asUser(db, admin);
  const document = { schemaVersion: "2", blocks: [{ id: "block-6", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: true, italic: true, underline: true }] }], pageLayout: {}, operations: [], savedAt: new Date().toISOString() };
  await db.query("select public.save_word_efficiency_model_answer($1,$2::jsonb)", [version, JSON.stringify(document)]);
  const saved = (await db.query("select model_answer_snapshot from public.word_efficiency_versions where id=$1", [version])).rows[0];
  assert.equal(saved.model_answer_snapshot.blocks[0].runs[0].bold, true);
  await db.close();
});

test("a rule with additional_criteria awards full marks only when every criterion matches, and zero when even one is missing", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "blocks.block-6.runs.0.bold", expectedOperation: "model-answer-match", expectedValue: "true", allocatedMarks: 5, partialMarks: null, additionalCriteria: [{ target: "blocks.block-6.runs.0.italic", expectedValue: "true" }, { target: "blocks.block-6.runs.0.underline", expectedValue: "true" }] }];
  await asUser(db, admin);
  await db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(rules)]);
  const saved = (await db.query("select additional_criteria from public.word_efficiency_grading_rules where version_id=$1", [version])).rows[0];
  assert.equal(saved.additional_criteria.length, 2);

  await asUser(db, student);
  const attemptAllMatch = "61000000-0000-0000-0000-000000000001";
  await db.query(attemptRow(attemptAllMatch, new Date().toISOString()));
  await db.query(scoreRows(attemptAllMatch));
  const fullMatchDocument = { schemaVersion: "2", blocks: [{ id: "block-6", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: true, italic: true, underline: true }] }], pageLayout: {}, operations: [], savedAt: new Date().toISOString() };
  await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)", [attemptAllMatch, JSON.stringify(fullMatchDocument)]);
  const fullMatchScore = (await db.query("select awarded_marks from public.word_efficiency_question_scores where attempt_id=$1 and question_number=1", [attemptAllMatch])).rows[0];
  assert.equal(Number(fullMatchScore.awarded_marks), 5);

  const attemptPartial = "61000000-0000-0000-0000-000000000002";
  await db.query(attemptRow(attemptPartial, new Date().toISOString()));
  await db.query(scoreRows(attemptPartial));
  const missingUnderlineDocument = { schemaVersion: "2", blocks: [{ id: "block-6", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: true, italic: true, underline: false }] }], pageLayout: {}, operations: [], savedAt: new Date().toISOString() };
  await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)", [attemptPartial, JSON.stringify(missingUnderlineDocument)]);
  const partialScore = (await db.query("select awarded_marks from public.word_efficiency_question_scores where attempt_id=$1 and question_number=1", [attemptPartial])).rows[0];
  assert.equal(Number(partialScore.awarded_marks), 0);
  await db.close();
});

test("a rule with no additional_criteria behaves exactly as the single-target rule did before this migration", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "blocks.block-6.runs.0.bold", expectedOperation: "bold", expectedValue: "true", allocatedMarks: 5, partialMarks: 1 }];
  await asUser(db, admin);
  await db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(rules)]);
  await asUser(db, student);
  const attemptId = "62000000-0000-0000-0000-000000000001";
  await db.query(attemptRow(attemptId, new Date().toISOString()));
  await db.query(scoreRows(attemptId));
  const document = { schemaVersion: "2", blocks: [{ id: "block-6", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: true }] }], pageLayout: {}, operations: [], savedAt: new Date().toISOString() };
  await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)", [attemptId, JSON.stringify(document)]);
  const score = (await db.query("select awarded_marks from public.word_efficiency_question_scores where attempt_id=$1 and question_number=1", [attemptId])).rows[0];
  assert.equal(Number(score.awarded_marks), 5);
  await db.close();
});

test("malformed additional criteria are rejected before any row is written", async () => {
  const db = await database();
  await asUser(db, admin);
  const badRules = [{ questionNumber: 1, exactTarget: "blocks.block-6.runs.0.bold", expectedOperation: "bold", expectedValue: "true", allocatedMarks: 5, partialMarks: null, additionalCriteria: [{ expectedValue: "true" }] }];
  await assert.rejects(db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(badRules)]));
  const rows = (await db.query("select count(*)::int as count from public.word_efficiency_grading_rules where version_id=$1", [version])).rows;
  assert.equal(rows[0].count, 0);
  await db.close();
});
